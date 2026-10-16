import type { Unidade } from "@/lib/api/types";
import { lerSnapshot, metadadosSnapshot } from "@/lib/api/snapshot";
import type { Indicador } from "@/lib/indicadores/tipos";
import { montarSerie } from "@/lib/indicadores/tipos";

/**
 * Meio ambiente — desmatamento.
 *
 * Fonte: PRODES, do INPE, que mede por satélite a supressão de vegetação nativa
 * na Amazônia Legal.
 *
 * POR QUE ESTE INDICADOR VEM DE ARQUIVO, E NÃO DE REDE
 *   O painel do TerraBrasilis publica a série anual como um JSON estático — mas
 *   o servidor NÃO envia `Access-Control-Allow-Origin`. Um `curl` funciona; o
 *   navegador não. Como a arquitetura do app não tem proxy (decisão explícita,
 *   para não exigir backend), o arquivo é colhido no build por
 *   `scripts/series-grandes.mjs` e embarcado.
 *
 *   O JSON do painel traz um período por ano do PRODES (agosto–julho, rotulado
 *   pelo ano de encerramento), com as áreas por estado da Amazônia Legal. A taxa
 *   nacional é a SOMA das features — conferida contra a série oficial:
 *   1988 = 21.050 km², 2023 = 9.064 km².
 *
 *   Para atualizar: `pnpm series:sincronizar`.
 *
 * Ficaram de fora, por falta de fonte oficial programaticamente acessível:
 *
 *   · Desmatamento no Cerrado (PRODES Cerrado) — o INPE só o expõe como camadas
 *     vetoriais no GeoServer (a `yearly_deforestation` do Cerrado tem 2,3 milhões
 *     de feições) e como rasters/GeoPackage para download; não há JSON/CSV
 *     público com a série anual, e a antiga API de análise foi descontinuada.
 *   · Emissões de gases de efeito estufa — o SEEG é do Observatório do Clima,
 *     uma ONG, não um órgão de governo; fica de fora pela regra de só fontes
 *     oficiais.
 */

const UNIDADE: Unidade = {
  simbolo: "km²",
  nome: "quilômetros quadrados desmatados por ano",
  casas: 0,
  sufixo: " km²",
};

const ARQUIVO = "desmatamento-amazonia.json";

const desmatamentoAmazonia: Indicador = {
  id: "desmatamento-amazonia-legal",
  nome: "Desmatamento na Amazônia Legal",
  curto: "Desmatamento (Amazônia)",
  categoria: "ambiente",
  descricao:
    "Área de vegetação nativa suprimida por ano na Amazônia Legal, medida por satélite. " +
    "O período do PRODES vai de agosto a julho e é nomeado pelo ano de encerramento; " +
    "os dois últimos períodos podem ser revisados antes da consolidação.",
  unidade: UNIDADE,
  frequencia: "anual",
  desde: 1988,
  direcao: "baixo-melhor",
  fonte: "inpe",
  codigo: "PRODES/INPE · TerraBrasilis",
  consulta:
    "https://terrabrasilis.dpi.inpe.br/app/dashboard/deforestation/biomes/legal_amazon/rates",
  normalizacoes: ["absoluto", "base100"],
  snapshot: ARQUIVO,
  async buscar() {
    const meta = metadadosSnapshot(ARQUIVO);
    if (!meta) {
      throw new Error(`Snapshot ausente: ${ARQUIVO}. Rode \`pnpm series:sincronizar\`.`);
    }
    return montarSerie(desmatamentoAmazonia, lerSnapshot(ARQUIVO), meta.url, {
      revisavel: true,
      geradoEm: meta.geradoEm,
    });
  },
};

export const INDICADORES_AMBIENTE: Indicador[] = [desmatamentoAmazonia];
