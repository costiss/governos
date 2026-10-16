import type { Ponto, Unidade } from "@/lib/api/types";
import { buscarJson } from "@/lib/api/http";
import type { Indicador } from "@/lib/indicadores/tipos";
import { montarSerie } from "@/lib/indicadores/tipos";

/**
 * Meio ambiente — desmatamento.
 *
 * A série é o PRODES, do INPE, que mede por satélite a supressão de vegetação
 * nativa. O painel do TerraBrasilis publica a taxa anual da Amazônia Legal como
 * um JSON estático, e é esse arquivo que lemos: ele é republicado a cada ano com
 * um nome novo (`rates<ano>.json`), então `buscar` procura alguns candidatos e
 * usa o primeiro que responder — sem chutar dado quando nenhum existe.
 *
 * O arquivo traz um registro por estado da Amazônia Legal; a taxa nacional é a
 * soma das features de cada período (conferida contra a série oficial:
 * 1988 = 21.050 km², 2023 = 9.064 km²).
 *
 * Ficaram de fora, por falta de fonte oficial programaticamente acessível:
 *
 *   · Desmatamento no Cerrado (PRODES Cerrado) — o INPE só o expõe como
 *     camadas vetoriais no GeoServer (a `yearly_deforestation` do Cerrado tem
 *     2,3 milhões de feições) e como rasters/GeoPackage para download; não há
 *     JSON/CSV público com a série anual, e a antiga API de análise
 *     (`/dashboard/api/v1/redis-cli/`) foi descontinuada (devolve 404).
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

const RAIZ = "https://terrabrasilis.dpi.inpe.br/app/prodes/dashboard/deforestation/files";

interface PeriodoProdes {
  startDate?: { year?: number };
  endDate?: { year?: number };
  features?: Array<{ areas?: Array<{ area?: number }> }>;
}

interface ArquivoProdes {
  name?: string;
  clazz?: string;
  periods?: PeriodoProdes[];
}

/** Cada período (agosto–julho) é rotulado pelo ano de encerramento. */
function extrairPontos(arquivo: ArquivoProdes): Ponto[] {
  const porAno = new Map<number, number>();
  for (const periodo of arquivo.periods ?? []) {
    const ano = periodo.endDate?.year;
    if (typeof ano !== "number") continue;
    let total = 0;
    for (const feature of periodo.features ?? []) {
      for (const area of feature.areas ?? []) {
        if (typeof area.area === "number" && Number.isFinite(area.area)) total += area.area;
      }
    }
    porAno.set(ano, total);
  }
  return [...porAno.entries()]
    .map(([ano, valor]) => ({ data: `${ano}-01-01`, valor }))
    .sort((a, b) => a.data.localeCompare(b.data));
}

/** Nomes de arquivo que o TerraBrasilis costuma publicar, do mais novo ao mais antigo. */
function candidatos(ano: number): string[] {
  return [`rates${ano}.json`, `rates${ano - 1}.json`, `rates${ano - 2}.json`];
}

const desmatamentoAmazonia: Indicador = {
  id: "desmatamento-amazonia-legal",
  nome: "Desmatamento na Amazônia Legal",
  curto: "Desmatamento (Amazônia)",
  categoria: "ambiente",
  descricao:
    "Área de vegetação nativa suprimida por ano na Amazônia Legal, medida por satélite. " +
    "O período do PRODES vai de agosto a julho e é nomeado pelo ano de encerramento.",
  unidade: UNIDADE,
  frequencia: "anual",
  desde: 1988,
  direcao: "baixo-melhor",
  fonte: "inpe",
  codigo: "PRODES/INPE · TerraBrasilis",
  consulta:
    "https://terrabrasilis.dpi.inpe.br/app/dashboard/deforestation/biomes/legal_amazon/rates",
  normalizacoes: ["absoluto", "base100"],
  async buscar({ signal }) {
    const anoAtual = new Date().getUTCFullYear();
    let ultimoErro: unknown;
    for (const arquivo of candidatos(anoAtual)) {
      const url = `${RAIZ}/${arquivo}`;
      try {
        const dados = await buscarJson<ArquivoProdes>(url, {
          rotulo: `desmatamento PRODES (${arquivo})`,
          signal,
        });
        const pontos = extrairPontos(dados);
        if (pontos.length > 0) {
          // O último período ainda é uma estimativa e pode ser consolidado depois.
          return montarSerie(desmatamentoAmazonia, pontos, url, { revisavel: true });
        }
      } catch (erro) {
        if (erro instanceof DOMException && erro.name === "AbortError") throw erro;
        ultimoErro = erro;
      }
    }
    throw ultimoErro instanceof Error
      ? ultimoErro
      : new Error("O TerraBrasilis não devolveu a série anual do PRODES");
  },
};

export const INDICADORES_AMBIENTE: Indicador[] = [desmatamentoAmazonia];
