# Candidatos 2026 — Rio Grande do Norte

[![Site no ar](https://img.shields.io/badge/site-no%20ar-00c7b7?style=for-the-badge&logo=netlify&logoColor=white)](https://candidatos-rn-2026.netlify.app/)
[![Nova função: cola eleitoral](https://img.shields.io/badge/nova%20fun%C3%A7%C3%A3o-cola%20eleitoral-6548f5?style=for-the-badge)](https://candidatos-rn-2026.netlify.app/)
[![Netlify Status](https://api.netlify.com/api/v1/badges/a46246a2-ed1b-4586-a43a-e2ddc5b65e91/deploy-status)](https://app.netlify.com/projects/candidatos-rn-2026/deploys)
[![Atualizar candidaturas](https://github.com/MagnosLima/eleicoes-2026-rn/actions/workflows/atualizar-candidatos.yml/badge.svg)](https://github.com/MagnosLima/eleicoes-2026-rn/actions/workflows/atualizar-candidatos.yml)

Guia eleitoral independente que reúne, em uma interface acessível e responsiva, as candidaturas à Presidência da República e aos cargos do Rio Grande do Norte nas Eleições 2026.

**[Acessar a demonstração](https://candidatos-rn-2026.netlify.app/)**

![Prévia do guia Candidatos 2026 — Rio Grande do Norte](assets/og-eleicoes-2026-rn.png)

## Destaque: cola eleitoral interativa

A pessoa pode montar sua própria cola seguindo exatamente a ordem das seis escolhas exibidas na urna:

1. deputado federal;
2. deputado estadual;
3. senador — primeira vaga;
4. senador — segunda vaga;
5. governador e vice-governador;
6. presidente e vice-presidente da República.

O fluxo foi projetado para celular e permite buscar cada candidatura por nome, número ou partido. Ao final, a cola pode ser:

- baixada como imagem;
- impressa ou salva como PDF;
- compartilhada pelo WhatsApp ou pelo menu nativo do dispositivo;
- retomada posteriormente no mesmo navegador.

As escolhas são armazenadas somente no `localStorage` do dispositivo. O projeto não exige cadastro, não utiliza banco de dados para essa função e não envia as escolhas ao servidor.

> **No dia da votação:** imprima ou anote a cola em papel. Conforme a [orientação do TSE](https://www.tse.jus.br/comunicacao/noticias/2026/Setembro/por-dentro-das-eleicoes-confira-as-regras-para-o-dia-da-votacao), celulares e outros equipamentos eletrônicos não podem entrar na cabine.

## Recursos

- Busca por nome, número, partido, coligação ou vice.
- Filtros por cargo e partido.
- Situação atual da candidatura e redes sociais declaradas ao TSE.
- Fotos oficiais com alternativa textual quando a imagem não está disponível.
- Layout responsivo, navegação por teclado e versão otimizada para impressão.
- Montagem guiada de cola eleitoral na ordem oficial da urna, com bloqueio de repetição entre as duas vagas do Senado.
- Cola salva somente no navegador, com exportação em imagem, impressão/PDF e compartilhamento pelo WhatsApp.
- Cópia local de contingência para indisponibilidades externas.

## Atualização automática

O workflow `.github/workflows/atualizar-candidatos.yml` é executado a cada 30 minutos. Ele consulta o DivulgaCand e os Dados Abertos do TSE, compara o resultado com a versão armazenada e cria um commit somente quando encontra mudanças.

O navegador consulta o JSON e as fotos diretamente no GitHub, usando a versão publicada no Netlify como contingência. Assim, atualizações de dados não exigem novos deploys de produção e preservam os créditos da hospedagem. Os commits automáticos também recebem `[skip netlify]` como proteção adicional.

```text
TSE → GitHub Actions → data/candidatos.json → navegador
```

O TSE informa que seus arquivos de Dados Abertos são atualizados quatro vezes ao dia. A execução mais frequente permite detectar cada nova carga sem criar commits desnecessários.

## Tecnologias

- HTML, CSS e JavaScript sem framework
- Node.js para coleta e normalização
- GitHub Actions para automação
- Netlify para hospedagem da interface e contingência
- GitHub para distribuição dos dados e fotos atualizados

## Executar localmente

```bash
npm install
npm run update-data
npx serve .
```

## Fonte e responsabilidade

Este é um projeto independente, sem vínculo com a Justiça Eleitoral e sem finalidade de recomendar candidaturas. A fonte primária é o [Portal de Dados Abertos do TSE](https://dadosabertos.tse.jus.br/pt_BR/dataset/candidatos-2026). Situações podem mudar; para confirmação oficial, consulte o [DivulgaCand](https://divulgacandcontas.tse.jus.br/divulga/).

O código-fonte está sob licença MIT. Dados, fotos e demais conteúdos provenientes do TSE permanecem sujeitos aos termos e créditos indicados pelo órgão. O mapa do RN conserva o crédito informado no rodapé da página.

## Autor

[Magnos Lima](https://github.com/MagnosLima) · [Instagram](https://www.instagram.com/mag.lima.ig/)
