import { unzipSync } from "fflate";

const YEAR = 2026;
const ELECTION_ID = "20322002026";
const OPEN_DATA_BASE = "https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand";
const DIVULGA_BASE = "https://divulgacandcontas.tse.jus.br/divulga/rest/v1/candidatura/listar";

const scopes = [
  { c: "Presidente", uf: "BR", cargo: 1 },
  { c: "Governador", uf: "RN", cargo: 3 },
  { c: "Senador", uf: "RN", cargo: 5 },
  { c: "Deputado federal", uf: "RN", cargo: 6 },
  { c: "Deputado estadual", uf: "RN", cargo: 7 },
];

const companionScopes = [
  { c: "Presidente", uf: "BR", cargo: 2 },
  { c: "Governador", uf: "RN", cargo: 4 },
];

const officeOrder = new Map(scopes.map((scope, index) => [scope.c, index]));
const tseHeaders = {
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
  "accept-language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
};

async function fetchTse(url, extraHeaders = {}) {
  const response = await fetch(url, {
    headers: { ...tseHeaders, ...extraHeaders },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(`TSE respondeu ${response.status}: ${message.slice(0, 160)}`);
  }
  return response;
}

function clean(value) {
  return String(value ?? "").trim();
}

function cleanCoalition(value) {
  return clean(value).replace(/[\s']+$/, "");
}

function photoPath(uf, id) {
  return `fotos/F${uf}${id}_div.jpg`;
}

function normalizeInstagram(value) {
  let candidate = clean(value);
  if (!/instagram\.com/i.test(candidate)) return null;
  if (!/^https?:\/\//i.test(candidate)) candidate = `https://${candidate.replace(/^\/+/, "")}`;
  try {
    const url = new URL(candidate);
    if (!/(^|\.)instagram\.com$/i.test(url.hostname)) return null;
    url.protocol = "https:";
    return url.href;
  } catch {
    return null;
  }
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ";") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  const [headers, ...values] = rows;
  return values.map(columns => Object.fromEntries(headers.map((header, index) => [header.replace(/^\uFEFF/, ""), columns[index] ?? ""])));
}

function extractCsv(zipBytes, pattern) {
  const files = unzipSync(zipBytes, { filter: file => pattern.test(file.name) });
  const decoder = new TextDecoder("windows-1252");
  return Object.entries(files).map(([name, bytes]) => ({ name, rows: parseCsv(decoder.decode(bytes)) }));
}

async function loadSocialNetworks() {
  const url = `${OPEN_DATA_BASE}/rede_social_candidato_${YEAR}.zip`;
  const response = await fetchTse(url, {
    accept: "application/zip,application/octet-stream,*/*",
    referer: "https://dadosabertos.tse.jus.br/",
  });
  const archives = extractCsv(new Uint8Array(await response.arrayBuffer()), /rede_social_candidato_2026_(RN|BR)\.csv$/i);
  const byCandidate = new Map();
  let generatedAt = "";
  for (const { rows } of archives) {
    for (const row of rows) {
      generatedAt ||= [row.DT_GERACAO, row.HH_GERACAO].filter(Boolean).join(" ");
      const instagram = normalizeInstagram(row.DS_URL);
      if (!instagram) continue;
      const id = clean(row.SQ_CANDIDATO);
      const links = byCandidate.get(id) || [];
      if (!links.includes(instagram)) links.push(instagram);
      byCandidate.set(id, links);
    }
  }
  return { byCandidate, generatedAt };
}

async function loadFromDivulgaCand() {
  const headers = {
    accept: "application/json, text/plain, */*",
    origin: "https://divulgacandcontas.tse.jus.br",
    referer: "https://divulgacandcontas.tse.jus.br/divulga/",
  };
  const fetchScope = async scope => {
    const url = `${DIVULGA_BASE}/${YEAR}/${scope.uf}/${ELECTION_ID}/${scope.cargo}/candidatos`;
    const response = await fetchTse(url, headers);
    const payload = await response.json();
    if (!Array.isArray(payload.candidatos)) throw new Error(`Resposta inválida para ${scope.c}.`);
    return payload.candidatos;
  };
  const [groups, companionGroups] = await Promise.all([
    Promise.all(scopes.map(async scope => {
      const candidates = await fetchScope(scope);
      return candidates.map(candidate => {
      const id = clean(candidate.id);
      return {
        c: scope.c,
        n: clean(candidate.nomeUrna),
        p: clean(candidate.partido?.sigla),
        num: clean(candidate.numero),
        s: clean(candidate.descricaoSituacao) || "Situação não informada",
        col: cleanCoalition(candidate.nomeColigacao),
        id,
        uf: scope.uf,
        photo: photoPath(scope.uf, id),
      };
      });
    })),
    Promise.all(companionScopes.map(async scope => ({ scope, candidates: await fetchScope(scope) }))),
  ]);
  const companionByTicket = new Map(companionGroups.flatMap(({ scope, candidates }) => candidates.map(candidate => [
    `${scope.c}|${clean(candidate.numero)}`,
    { v: clean(candidate.nomeUrna), vp: clean(candidate.partido?.sigla) },
  ])));
  return groups.flat().map(candidate => ({
    ...candidate,
    ...(companionByTicket.get(`${candidate.c}|${candidate.num}`) || {}),
  }));
}

async function loadFromOpenData() {
  const url = `${OPEN_DATA_BASE}/consulta_cand_${YEAR}.zip`;
  const response = await fetchTse(url, {
    accept: "application/zip,application/octet-stream,*/*",
    referer: "https://dadosabertos.tse.jus.br/",
  });
  const archives = extractCsv(new Uint8Array(await response.arrayBuffer()), /consulta_cand_2026_(RN|BR)\.csv$/i);
  const officeNames = new Map(scopes.map(scope => [scope.c.toLocaleUpperCase("pt-BR"), scope.c]));
  const companionNames = new Map([
    ["VICE-PRESIDENTE", "Presidente"],
    ["VICE-GOVERNADOR", "Governador"],
  ]);
  const allRows = archives.flatMap(({ name, rows }) => rows.map(row => ({ row, name })));
  const companionByTicket = new Map(allRows.flatMap(({ row }) => {
    const office = companionNames.get(clean(row.DS_CARGO).toLocaleUpperCase("pt-BR"));
    return office ? [[`${office}|${clean(row.NR_CANDIDATO)}`, {
      v: clean(row.NM_URNA_CANDIDATO),
      vp: clean(row.SG_PARTIDO),
    }]] : [];
  }));
  return allRows.flatMap(({ name, row }) => {
    const office = officeNames.get(clean(row.DS_CARGO).toLocaleUpperCase("pt-BR"));
    if (!office) return [];
    const uf = /_BR\.csv$/i.test(name) ? "BR" : "RN";
    const id = clean(row.SQ_CANDIDATO);
    return [{
      c: office,
      n: clean(row.NM_URNA_CANDIDATO),
      p: clean(row.SG_PARTIDO),
      num: clean(row.NR_CANDIDATO),
      s: "Consulte a situação no DivulgaCand",
      col: clean(row.NM_COLIGACAO),
      id,
      uf,
      photo: photoPath(uf, id),
      ...(companionByTicket.get(`${office}|${clean(row.NR_CANDIDATO)}`) || {}),
    }];
  });
}

function sortCandidates(candidates) {
  return candidates.sort((a, b) =>
    (officeOrder.get(a.c) - officeOrder.get(b.c)) || a.n.localeCompare(b.n, "pt-BR")
  );
}

export async function loadTseData() {
  const socialPromise = loadSocialNetworks().catch(error => {
    console.warn("Não foi possível atualizar as redes sociais:", error.message);
    return { byCandidate: new Map(), generatedAt: "" };
  });
  let candidates;
  let mode = "DivulgaCand";
  try {
    candidates = await loadFromDivulgaCand();
  } catch (error) {
    console.warn("DivulgaCand indisponível; usando Dados Abertos:", error.message);
    candidates = await loadFromOpenData();
    mode = "Dados Abertos";
  }
  const social = await socialPromise;
  for (const candidate of candidates) candidate.ig = social.byCandidate.get(candidate.id) || [];
  const ids = new Set(candidates.map(candidate => candidate.id));
  if (candidates.length < 250 || ids.size !== candidates.length) throw new Error("Conjunto do TSE incompleto ou com identificadores duplicados.");
  const sorted = sortCandidates(candidates);
  return {
    schemaVersion: 1,
    fetchedAt: new Date().toISOString(),
    sourceGeneratedAt: social.generatedAt || null,
    sourceMode: mode,
    sourceUrl: "https://dadosabertos.tse.jus.br/pt_BR/dataset/candidatos-2026",
    counts: Object.fromEntries(scopes.map(scope => [scope.c, sorted.filter(candidate => candidate.c === scope.c).length])),
    candidates: sorted,
  };
}
