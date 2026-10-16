import type { Serie, Unidade } from "@/lib/api/types";
import { buscarIpea, montarUrlIpea } from "@/lib/api/ipea";
import { CODIGO_UF } from "@/lib/api/sidra";
import type { Indicador } from "@/lib/indicadores/tipos";
import { montarSerie } from "@/lib/indicadores/tipos";

/**
 * Segurança — mortes violentas.
 *
 * Tudo vem do Ipea Data, que republica o Sistema de Informações sobre Mortalidade
 * (MS/SVS) usado pelo Atlas da Violência. As séries `AVIOL12_*` trazem o Brasil
 * inteiro numa só chamada, com o recorte estadual embutido na coluna `TERCODIGO`
 * (`"0"` = Brasil; demais = código IBGE de duas casas). O `$filter` do OData é
 * ignorado pelo serviço, então o recorte territorial é feito no cliente — e por
 * isso a taxa de homicídios, a única com peso no mapa, declara `serieEstadual`.
 *
 * Ficaram de fora, por não existirem em fonte oficial acessível por API:
 *
 *   · Taxa de homicídios de jovens e de mulheres — só há o número absoluto
 *     (`AVIOL12_HOMICJ`, `AVIOL12_HOMICF`); o Ipea não publica a taxa por 100 mil
 *     desses recortes. As absolutas aparecem aqui, e a taxa nacional já traz o
 *     Brasil como um todo.
 *   · Dados da SENASP/Ministério da Justiça (ocorrências policiais) — não há API
 *     pública; os anuários são PDF/planilha.
 */

const POR_CEM_MIL: Unidade = {
  simbolo: "por 100 mil hab.",
  nome: "homicídios por 100 mil habitantes",
  casas: 1,
};

const CONTAGEM: Unidade = {
  simbolo: "homicídios",
  nome: "homicídios no ano (número absoluto)",
  casas: 0,
};

/**
 * Uma série do Ipea Data, já com a procedência preenchida.
 *
 * `territorio` restringe ao código IBGE do território; ausente, o indicador é
 * nacional e o recorte é o Brasil (`"0"`). Um único `TERCODIGO` por vez: a série
 * chega com municípios, estados e Brasil juntos — até ~70 MB —, então o filtro
 * é local.
 */
async function serieIpea(
  indicador: Indicador,
  codigo: string,
  territorio: string | undefined,
  signal?: AbortSignal,
): Promise<Serie> {
  const pontos = await buscarIpea({ codigo, rotulo: indicador.nome, territorio, signal });
  return montarSerie(indicador, pontos, montarUrlIpea(codigo));
}

const taxaHomicidios: Indicador = {
  id: "taxa-homicidios",
  nome: "Taxa de homicídios",
  curto: "Homicídios",
  categoria: "seguranca",
  descricao:
    "Óbitos por agressão (CID-10 X85–Y09 e Y35) a cada 100 mil habitantes, segundo o local " +
    "de residência. Cobre o Brasil e o recorte por Unidade da Federação.",
  unidade: POR_CEM_MIL,
  frequencia: "anual",
  desde: 1980,
  direcao: "baixo-melhor",
  fonte: "ipea",
  codigo: "Ipea AVIOL12_THOMIC",
  consulta: "https://www.ipeadata.gov.br/ExibeSerie.aspx?serid=1611149422",
  normalizacoes: ["absoluto", "base100"],
  // Recorte por UF numa chamada só (una série estadual oculta em TERCODIGO).
  porUf: true,
  serieEstadual: "AVIOL12_THOMIC",
  async buscar({ uf, signal }) {
    const territorio = uf ? (CODIGO_UF[uf] ?? "0") : "0";
    return serieIpea(taxaHomicidios, "AVIOL12_THOMIC", territorio, signal);
  },
};

const homicidios: Indicador = {
  id: "homicidios",
  nome: "Número de homicídios",
  curto: "Homicídios (nº)",
  categoria: "seguranca",
  descricao:
    "Total de homicídios por ano, em números absolutos, segundo o local de residência.",
  unidade: CONTAGEM,
  frequencia: "anual",
  desde: 1979,
  direcao: "baixo-melhor",
  fonte: "ipea",
  codigo: "Ipea AVIOL12_HOMIC",
  consulta: "https://www.ipeadata.gov.br/ExibeSerie.aspx?serid=1611149386",
  normalizacoes: ["absoluto", "base100", "perCapita"],
  async buscar({ signal }) {
    return serieIpea(homicidios, "AVIOL12_HOMIC", "0", signal);
  },
};

const homicidiosJovens: Indicador = {
  id: "homicidios-jovens",
  nome: "Homicídios de jovens (15 a 29 anos)",
  curto: "Homicídios de jovens",
  categoria: "seguranca",
  descricao:
    "Homicídios de pessoas de 15 a 29 anos por ano, em números absolutos — a faixa mais " +
    "atingida pela violência letal no país.",
  unidade: CONTAGEM,
  frequencia: "anual",
  desde: 1980,
  direcao: "baixo-melhor",
  fonte: "ipea",
  codigo: "Ipea AVIOL12_HOMICJ",
  consulta: "https://www.ipeadata.gov.br/ExibeSerie.aspx?serid=1611149389",
  normalizacoes: ["absoluto", "base100", "perCapita"],
  async buscar({ signal }) {
    return serieIpea(homicidiosJovens, "AVIOL12_HOMICJ", "0", signal);
  },
};

const homicidiosFemininos: Indicador = {
  id: "homicidios-femininos",
  nome: "Homicídios de mulheres",
  curto: "Homicídios femininos",
  categoria: "seguranca",
  descricao:
    "Homicídios de pessoas do sexo feminino por ano, em números absolutos, segundo o local " +
    "de residência.",
  unidade: CONTAGEM,
  frequencia: "anual",
  desde: 1980,
  direcao: "baixo-melhor",
  fonte: "ipea",
  codigo: "Ipea AVIOL12_HOMICF",
  consulta: "https://www.ipeadata.gov.br/ExibeSerie.aspx?serid=1611149387",
  normalizacoes: ["absoluto", "base100", "perCapita"],
  async buscar({ signal }) {
    return serieIpea(homicidiosFemininos, "AVIOL12_HOMICF", "0", signal);
  },
};

export const INDICADORES_SEGURANCA: Indicador[] = [
  taxaHomicidios,
  homicidios,
  homicidiosJovens,
  homicidiosFemininos,
];
