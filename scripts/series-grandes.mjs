#!/usr/bin/env node
/**
 * Sincroniza as séries que são grandes demais para o navegador baixar.
 *
 * PROBLEMA
 *   Algumas séries do Ipea Data misturam Brasil, as 27 UFs e os 5.570
 *   municípios numa resposta só — e o serviço OData IGNORA `$top`, `$skip` e
 *   `$filter` (testado: devolve os mesmos ~70 MB de qualquer jeito). Buscar
 *   isso pelo navegador significaria ~70 MB por visitante, que é exatamente o
 *   abuso que este app existe para evitar.
 *
 * SOLUÇÃO
 *   Buscar UMA vez, aqui, filtrar para Brasil + UFs, e gravar um JSON de poucos
 *   KB em `src/lib/indicadores/dados/`. O app lê o arquivo: zero requisições em
 *   runtime, e o dado continua sendo oficial — só que colhido no build.
 *
 * USO
 *   node scripts/series-grandes.mjs            # atualiza o que estiver vencido
 *   node scripts/series-grandes.mjs --forcar    # refaz tudo
 *
 * O arquivo gerado registra a data de coleta e a URL exata, e o app mostra
 * ambos na ficha de procedência. Snapshot sem carimbo de data é dado sem
 * procedência.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const DESTINO = resolve(AQUI, "../src/lib/indicadores/dados");

const BASE_IPE = "https://www.ipeadata.gov.br/api/odata4";

/** Séries a capturar, e a que nível territorial reduzir. */
const SERIES = [
  {
    codigo: "AVIOL12_THOMIC",
    arquivo: "homicidios-uf.json",
    descricao: "Taxa de homicídios por 100 mil habitantes — Brasil e UFs",
    niveis: ["brasil", "uf"],
  },
  {
    codigo: "AVIOL12_HOMIC",
    arquivo: "homicidios-absoluto-uf.json",
    descricao: "Número de homicídios — Brasil e UFs",
    niveis: ["brasil", "uf"],
  },
];

const FORCAR = process.argv.includes("--forcar");
/** Um snapshot vale por 180 dias: a série é anual e publicada com atraso. */
const VALIDADE_DIAS = 180;

function casarNivel(codigo, nivel) {
  if (nivel === "brasil") return codigo === "0" || codigo === "1" || codigo === "";
  if (nivel === "uf") return /^\d{2}$/.test(codigo);
  return /^\d{7}$/.test(codigo);
}

async function contarPontos(arquivo) {
  try {
    const bruto = await import(`node:fs/promises`).then((fs) => fs.readFile(arquivo, "utf8"));
    const json = JSON.parse(bruto);
    const idade = (Date.now() - Date.parse(json.geradoEm)) / 86_400_000;
    return { pontos: json.pontos.length, idade, vencido: idade > VALIDADE_DIAS };
  } catch {
    return null;
  }
}

async function capturar(serie) {
  const url = `${BASE_IPE}/ValoresSerie(SERCODIGO='${serie.codigo}')`;
  process.stdout.write(`  baixando ${serie.codigo} (pode passar de 60 MB)… `);
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
    // "0"/"1"/"" é o Brasil; os demais são a UF pelo código de 2 dígitos.
    pontos.push({
      d: data,
      u: /^\d{2}$/.test(territorio) ? territorio : undefined,
      v: Math.round(numero * 1e6) / 1e6,
    });
  }

  pontos.sort((a, b) => a.d.localeCompare(b.d) || (a.u ?? "").localeCompare(b.u ?? ""));

  const segundos = ((Date.now() - inicio) / 1000).toFixed(1);
  console.log(`${valores.length} recebidos → ${pontos.length} guardados em ${segundos}s`);

  return {
    codigo: serie.codigo,
    descricao: serie.descricao,
    fonte: "Ipea Data",
    url,
    geradoEm: new Date().toISOString(),
    pontos,
  };
}

async function principal() {
  await mkdir(DESTINO, { recursive: true });
  console.log(`Séries grandes → ${DESTINO}\n`);
  let atualizados = 0;

  for (const serie of SERIES) {
    const arquivo = resolve(DESTINO, serie.arquivo);
    const atual = await contarPontos(arquivo);

    if (!FORCAR && atual && !atual.vencido) {
      console.log(`  ${serie.arquivo}: em dia (${atual.pontos} pontos, ${atual.idade.toFixed(0)} dias)`);
      continue;
    }

    try {
      const conteudo = await capturar(serie);
      await writeFile(arquivo, JSON.stringify(conteudo), "utf8");
      const kb = (JSON.stringify(conteudo).length / 1024).toFixed(0);
      console.log(`  ${serie.arquivo}: gravado (${kb} KB)\n`);
      atualizados += 1;
    } catch (erro) {
      console.error(`  ${serie.arquivo}: FALHOU — ${erro.message}\n`);
    }
  }

  console.log(atualizados === 0 ? "Nada a fazer." : `${atualizados} arquivo(s) atualizado(s).`);
}

await principal();
