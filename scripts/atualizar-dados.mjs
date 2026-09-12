import { access, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadTseData } from "./lib/tse-data.mjs";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataPath = resolve(projectRoot, "data", "candidatos.json");
const skipPhotos = process.env.SKIP_PHOTOS === "1";
const imageHeaders = {
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
  accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
  "accept-language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
  referer: "https://divulgacandcontas.tse.jus.br/divulga/",
};

async function readExisting() {
  try {
    return JSON.parse(await readFile(dataPath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function fileExists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function downloadMissingPhoto(candidate) {
  const relativePath = `fotos/F${candidate.uf}${candidate.id}_div.jpg`;
  candidate.photo = relativePath;
  if (skipPhotos) return;
  const destination = resolve(projectRoot, relativePath);
  if (await fileExists(destination)) return;

  const url = `https://divulgacandcontas.tse.jus.br/divulga/rest/arquivo/img/20322002026/${candidate.id}/${candidate.uf}`;
  try {
    const response = await fetch(url, { headers: imageHeaders, signal: AbortSignal.timeout(15_000) });
    if (!response.ok || !/^image\//i.test(response.headers.get("content-type") || "")) {
      throw new Error(`HTTP ${response.status}`);
    }
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, new Uint8Array(await response.arrayBuffer()));
    console.log(`Foto adicionada: ${candidate.n}`);
  } catch (error) {
    console.warn(`Foto indisponível para ${candidate.n}: ${error.message}`);
  }
}

function comparable(data) {
  if (!data) return "";
  return JSON.stringify({
    schemaVersion: data.schemaVersion,
    sourceGeneratedAt: data.sourceGeneratedAt,
    counts: data.counts,
    candidates: data.candidates,
  });
}

const existing = await readExisting();
const existingById = new Map((existing?.candidates || []).map(candidate => [candidate.id, candidate]));
const data = await loadTseData();

for (const candidate of data.candidates) {
  const previous = existingById.get(candidate.id);
  if (!data.sourceGeneratedAt && previous?.ig?.length) candidate.ig = previous.ig;
  if (data.sourceMode === "Dados Abertos" && previous?.s) candidate.s = previous.s;
  await downloadMissingPhoto(candidate);
}

if (comparable(existing) === comparable(data)) {
  console.log(`Sem alterações nos dados oficiais (${data.candidates.length} candidaturas).`);
  process.exit(0);
}

await mkdir(dirname(dataPath), { recursive: true });
const temporaryPath = `${dataPath}.tmp`;
await writeFile(temporaryPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
await rename(temporaryPath, dataPath);
console.log(`Dados atualizados: ${data.candidates.length} candidaturas.`, data.counts);
