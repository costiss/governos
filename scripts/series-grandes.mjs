#!/usr/bin/env node
/**
 * Sincroniza as séries que o NAVEGADOR não consegue buscar.
 *
 * DOIS MOTIVOS, O MESMO REMÉDIO
 *
 *   1. Tamanho — algumas séries do Ipea Data misturam Brasil, as 27 UFs e os
 *      5.570 municípios numa resposta só, e o serviço OData IGNORA `$top`,
 *      `$skip` e `$filter` (testado: devolve os mesmos ~70 MB de qualquer
 *      jeito). Buscar isso pelo navegador seriam ~70 MB por visitante.
 *
 *   2. CORS — o painel do PRODES (INPE) serve o JSON do desmatamento sem
 *      `Access-Control-Allow-Origin`. `curl` funciona; o navegador não. Não há
 *      proxy no app por decisão de arquitetura, então o dado é colhido aqui.
 *
 * O QUE SAI DAQUI
 *   JSON de poucos KB em `src/lib/indicadores/dados/`, com o carimbo de coleta
 *   e a URL de origem. Em runtime o app lê o arquivo: zero requisições.
 *   A interface mostra a data e a origem — snapshot sem carimbo de data é dado
 *   sem procedência.
 *
 * USO
 *   pnpm series:sincronizar            # atualiza o que estiver vencido
 *   node scripts/series-grandes.mjs --forcar
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const DESTINO = resolve(AQUI, "../src/lib/indicadores/dados");

const BASE_IPEA = "https://www.ipeadata.gov.br/api/odata4";
const BASE_PRODES = "https://terrabrasilis.dpi.inpe.br/app/prodes/dashboard/deforestation/files";

/** Um snapshot vale por 180 dias: as séries são anuais e saem com atraso. */
const VALIDADE_DIAS = 180;
const FORCAR = process.argv.includes("--forcar");

// ─────────────────────────────────────────────────────────────────────────────
// Fontes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Só o código "0" é o Brasil. O Ipea usa "1" para o agregado de REGIÕES e
 * "2"–"5" para as cinco regiões — todos de um dígito, e todos distintos do
 * Brasil. Tratá-los como nacional duplicava cada ano (o Brasil aparecia com
 * 11,69 e com 10,27 em 1980, sendo só o primeiro o país).
 */
const casarNivel = (codigo, nivel) => {
  if (nivel === "brasil") return codigo === "0" || codigo === "";
  if (nivel === "uf") return /^\d{2}$/.test(codigo);
  return /^\d{7}$/.test(codigo);
};

/** Ipea Data: uma SERCODIGO inteira, reduzida a Brasil + UFs. */
async function capturarIpea(serie) {
  const url = `${BASE_IPEA}/ValoresSerie(SERCODIGO='${serie.codigo}')`;
  process.stdout.write(`  baixando ${serie.codigo} (chega a passar de 60 MB)… `);
  const inicio = Date.now();

  const resposta = await fetch(url, { headers: { Accept: "application/json" } });
  if (!resposta.ok) throw new Error(`HTTP ${resposta.status} em ${serie.codigo}`);
  const dados = await resposta.json();
  const valores = Array.isArray(dados?.value) ? dados.value : [];

  const pontos = [];
  for (const valor of valores) {
    const territorio = String(valor.TERCODIGO ?? "");
    if (!serie.niveis.some((nivel) => casarNivel(territorio, nivel))) continue;
    const numero = Number(valor.VALVALOR);
    if (!Number.isFinite(numero)) continue;
    const data = String(valor.VALDATA ?? "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) continue;
    pontos.push({
      d: data,
      u: /^\d{2}$/.test(territorio) ? territorio : undefined,
      v: Math.round(numero * 1e6) / 1e6,
    });
  }
  pontos.sort((a, b) => a.d.localeCompare(b.d) || (a.u ?? "").localeCompare(b.u ?? ""));

  console.log(
    `${valores.length} recebidos → ${pontos.length} guardados em ${((Date.now() - inicio) / 1000).toFixed(1)}s`,
  );
  return { url, fonte: "Ipea Data", pontos };
}

/**
 * PRODES (INPE): o JSON do painel traz um período por ano do PRODES
 * (agosto–julho, rotulado pelo ano de encerramento), e cada período traz as
 * áreas por estado da Amazônia Legal. A taxa nacional é a soma.
 */
async function capturarProdes() {
  let arquivo = null;
  let url = "";
  // O nome do arquivo carrega o ano corrente; recuamos até achar um que exista.
  for (let ano = new Date().getUTCFullYear() + 1; ano >= 2020; ano -= 1) {
    const candidato = `${BASE_PRODES}/rates${ano}.json`;
    process.stdout.write(`  tentando rates${ano}.json… `);
    const resposta = await fetch(candidato, { headers: { Accept: "application/json" } });
    if (resposta.ok) {
      arquivo = await resposta.json();
      url = candidato;
      console.log("ok");
      break;
    }
    console.log(`HTTP ${resposta.status}`);
  }
  if (!arquivo) throw new Error("nenhum rates<ano>.json respondeu");

  const pontos = [];
  for (const periodo of arquivo.periods ?? []) {
    const ano = periodo?.endDate?.year;
    if (typeof ano !== "number") continue;
    let total = 0;
    for (const feature of periodo.features ?? []) {
      for (const area of feature.areas ?? []) {
        if (typeof area?.area === "number") total += area.area;
      }
    }
    if (total > 0) pontos.push({ d: `${ano}-01-01`, v: total });
  }
  pontos.sort((a, b) => a.d.localeCompare(b.d));

  console.log(
    `  ${arquivo.periods?.length ?? 0} períodos → ${pontos.length} anos (${pontos[0]?.d.slice(0, 4)}–${pontos.at(-1)?.d.slice(0, 4)})`,
  );
  return { url, fonte: "INPE — PRODES/TerraBrasilis", pontos };
}

/**
 * Séries do Atlas do Desenvolvimento Humano (PNUD/Ipea/FJP).
 *
 * Cada uma entrega 16.776–22.379 linhas porque traz os 5.564 municípios — para
 * render apenas Brasil + 27 UFs em 3 ou 4 anos censitários. São ~2,4 MB por
 * indicador, ou ~15 MB no total, para cerca de 100 pontos úteis: 0,5% de
 * aproveitamento. O snapshot reduz cada série a ~1 KB.
 */
const ATLAS = [
  ["ADH_IDHM", "atlas-idhm.json", "IDH — Índice de Desenvolvimento Humano"],
  ["ADH_T_ANALF15M", "atlas-analfabetismo.json", "Taxa de analfabetismo — 15 anos ou mais"],
  ["ADH_ESPVIDA", "atlas-esperanca-vida.json", "Esperança de vida ao nascer"],
  ["ADH_MORT1", "atlas-mortalidade-infantil.json", "Mortalidade infantil"],
  ["ADH_T_FLFUND", "atlas-frequencia-fundamental.json", "Frequência ao ensino fundamental"],
  ["ADH_PIND", "atlas-extrema-pobreza.json", "Extrema pobreza"],
];

const SERIES = [
  ...ATLAS.map(([codigo, arquivo, descricao]) => ({
    arquivo,
    descricao,
    motivo: "série do Atlas traz 5.564 municípios (~2,4 MB) para 3 anos censitários",
    capturar: () =>
      capturarIpea({
        codigo,
        niveis: ["brasil", "uf"],
      }),
  })),
  {
    arquivo: "homicidios-uf.json",
    descricao: "Taxa de homicídios por 100 mil habitantes — Brasil e UFs",
    motivo: "Ipea devolve ~70 MB e ignora $top/$filter",
    capturar: () =>
      capturarIpea({
        codigo: "AVIOL12_THOMIC",
        niveis: ["brasil", "uf"],
      }),
  },
  {
    arquivo: "homicidios-absoluto-uf.json",
    descricao: "Número de homicídios — Brasil e UFs",
    motivo: "Ipea devolve ~65 MB e ignora $top/$filter",
    capturar: () =>
      capturarIpea({
        codigo: "AVIOL12_HOMIC",
        niveis: ["brasil", "uf"],
      }),
  },
  {
    arquivo: "suicidios-uf.json",
    descricao: "Taxa de suicídios por 100 mil habitantes — Brasil e UFs",
    motivo: "Ipea devolve ~65 MB e ignora $top/$filter",
    capturar: () =>
      capturarIpea({
        codigo: "AVIOL12_TSUICID",
        niveis: ["brasil", "uf"],
      }),
  },
  {
    arquivo: "acidentes-transito-uf.json",
    descricao: "Taxa de óbitos por acidente de trânsito por 100 mil habitantes — Brasil e UFs",
    motivo: "Ipea devolve ~73 MB e ignora $top/$filter",
    capturar: () =>
      capturarIpea({
        codigo: "AVIOL12_TACIDT",
        niveis: ["brasil", "uf"],
      }),
  },
  {
    arquivo: "bolsa-familia-beneficios-uf.json",
    descricao: "Bolsa Família — número de benefícios em dezembro — Brasil e UFs",
    motivo: "Ipea devolve ~20 MB com os 5.570 municípios e ignora $top/$filter",
    capturar: () =>
      capturarIpea({
        codigo: "FAM_PBF",
        niveis: ["brasil", "uf"],
      }),
  },
  {
    arquivo: "desmatamento-amazonia.json",
    descricao: "Desmatamento na Amazônia Legal — PRODES",
    motivo: "o TerraBrasilis não envia Access-Control-Allow-Origin",
    capturar: capturarProdes,
  },
];

// ─────────────────────────────────────────────────────────────────────────────

async function estadoAtual(arquivo) {
  try {
    const json = JSON.parse(await readFile(resolve(DESTINO, arquivo), "utf8"));
    const idade = (Date.now() - Date.parse(json.geradoEm)) / 86_400_000;
    return { pontos: json.pontos.length, idade, vencido: idade > VALIDADE_DIAS };
  } catch {
    return null;
  }
}

async function principal() {
  await mkdir(DESTINO, { recursive: true });
  console.log(`Séries que o navegador não busca → ${DESTINO}\n`);
  let atualizados = 0;

  for (const serie of SERIES) {
    const atual = await estadoAtual(serie.arquivo);

    if (!FORCAR && atual && !atual.vencido) {
      console.log(
        `  ${serie.arquivo}: em dia (${atual.pontos} pontos, ${atual.idade.toFixed(0)} dias)\n`,
      );
      continue;
    }

    console.log(`  ${serie.arquivo} — ${serie.motivo}`);
    try {
      const { url, fonte, pontos } = await serie.capturar();
      const conteudo = {
        descricao: serie.descricao,
        fonte,
        motivo: serie.motivo,
        url,
        geradoEm: new Date().toISOString(),
        pontos,
      };
      const texto = JSON.stringify(conteudo);
      await writeFile(resolve(DESTINO, serie.arquivo), texto, "utf8");
      console.log(`  ${serie.arquivo}: gravado (${(texto.length / 1024).toFixed(0)} KB)\n`);
      atualizados += 1;
    } catch (erro) {
      console.error(`  ${serie.arquivo}: FALHOU — ${erro.message}\n`);
    }
  }

  console.log(atualizados === 0 ? "Nada a fazer." : `${atualizados} arquivo(s) atualizado(s).`);
}

await principal();
