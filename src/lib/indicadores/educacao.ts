import { buscarIpea, buscarIpeaPorTerritorio, montarUrlIpea } from "@/lib/api/ipea";
import { CODIGO_UF } from "@/lib/api/sidra";
import { montarSerie, serieDoSnapshot} from "@/lib/indicadores/tipos";
import type { Normalizacao, Unidade } from "@/lib/api/types";
import type { Indicador } from "@/lib/indicadores/tipos";

/**
 * Indicadores de educação.
 *
 * Duas famílias de fonte, ambas oficiais e servidas pelo Ipea Data:
 *
 *   · Censos Demográficos, via Atlas do Desenvolvimento Humano (PNUD/Ipea/FJP):
 *     decenais — 1991, 2000, 2010 e, no analfabetismo, também 2022. A frequência
 *     declarada é `"anual"` porque o contrato não tem "decenal"; o salto de dez
 *     anos vai descrito em cada indicador.
 *   · PNAD Contínua (IBGE): anual, por Unidade da Federação, de 2016 em diante.
 *
 * O recorte territorial é feito no cliente: o Ipea Data não aceita `$filter`, e
 * as séries estaduais já voltam com todos os territórios numa chamada.
 *
 * Ficaram de fora, por não haver série em fonte oficial acessível por API:
 *
 *   · IDEB (INEP) — o Inep publica o índice em planilhas e painéis de BI, sem
 *     API REST documentada; não há série equivalente no Ipea Data.
 *   · Taxa de analfabetismo funcional — não existe no Ipea Data nem na PNAD
 *     Contínua (o IBGE só publica "taxa de analfabetismo", 15+); as "Séries
 *     Estatísticas" que a trazem (1992–2009) estão descontinuadas e não têm API.
 */

/** Percentuais: só o valor publicado — índice base 100 não faz sentido para taxas. */
const PCT_VALOR: Normalizacao[] = ["absoluto"];

/** Níveis em anos: além do valor, base 100 compara ritmos entre UFs. */
const ANOS_NIVEIS: Normalizacao[] = ["absoluto", "base100"];

/** Unidade de uma taxa em pontos percentuais. */
function percentual(nome: string): Unidade {
  return { simbolo: "%", nome, casas: 1, sufixo: " %" };
}

const ANOS: Unidade = {
  simbolo: "anos",
  nome: "média de anos de estudo completados",
  casas: 1,
  sufixo: " anos",
};

/**
 * Taxa de analfabetismo — 15 anos ou mais.
 *
 * A série mais longa e mais recente de analfabetismo entre as fontes oficiais:
 * quatro censos (1991, 2000, 2010 e 2022). A série histórica `TXA15M` foi
 * descartada — a consulta ao vivo devolve só 1900 e 1920 (e está inativa).
 */
const analfabetismo: Indicador = {
  id: "analfabetismo",
  nome: "Taxa de analfabetismo — 15 anos ou mais",
  curto: "Analfabetismo 15+",
  categoria: "educacao",
  descricao:
    "Percentual das pessoas de 15 anos ou mais que não sabem ler nem escrever um bilhete simples. " +
    "Elaborada pelo Atlas do Desenvolvimento Humano (PNUD, Ipea e FJP) a partir dos Censos Demográficos: " +
    "um ponto a cada dez anos — 1991, 2000, 2010 e 2022.",
  unidade: percentual("percentual da população de 15 anos ou mais"),
  frequencia: "anual",
  desde: 1991,
  direcao: "baixo-melhor",
  fonte: "ipea",
  codigo: "IPEADATA ADH_T_ANALF15M",
  consulta: "https://www.ipeadata.gov.br/ExibeSerie.aspx?serid=2096726409",
  normalizacoes: PCT_VALOR,
  // A série do Atlas entrega 22.379 linhas (os 5.564 municípios) para render
  // Brasil + 27 UFs em 4 anos censitários. O snapshot reduz a ~4 KB.
  snapshot: "atlas-analfabetismo.json",
  buscar: async () => serieDoSnapshot(analfabetismo, "atlas-analfabetismo.json"),
};

/**
 * Taxa de analfabetismo por UF — 15 anos ou mais.
 *
 * A série estadual anual da PNAD Contínua, que alimenta o mapa. Sem pontos em
 * 2020 e 2021 (a divulgação anual por UF tem lacuna nesses dois anos).
 */
const analfabetismoUf: Indicador = {
  id: "analfabetismo-uf",
  nome: "Taxa de analfabetismo por UF — 15 anos ou mais",
  curto: "Analfabetismo 15+ (UF)",
  categoria: "educacao",
  descricao:
    "Percentual das pessoas de 15 anos ou mais que não sabem ler nem escrever um bilhete simples, " +
    "por Unidade da Federação. Série anual da PNAD Contínua, de 2016 em diante; não há ponto em 2020 " +
    "e 2021, então a linha tem uma lacuna de dois anos.",
  unidade: percentual("percentual da população de 15 anos ou mais"),
  frequencia: "anual",
  desde: 2016,
  direcao: "baixo-melhor",
  fonte: "ipea",
  codigo: "IPEADATA PNADCA_TXA15MUF",
  consulta: "https://www.ipeadata.gov.br/ExibeSerie.aspx?serid=2096726941",
  normalizacoes: PCT_VALOR,
  porUf: true,
  serieEstadual: "PNADCA_TXA15MUF",
  buscar: async ({ uf, signal }) => {
    const porTerritorio = await buscarIpeaPorTerritorio({
      codigo: "PNADCA_TXA15MUF",
      rotulo: "taxa de analfabetismo por UF (PNAD Contínua)",
      signal,
    });
    // Sem UF pedida, devolve o Brasil (TERCODIGO "0"); a chave da UF é o código do IBGE.
    const chave = uf ? (CODIGO_UF[uf] ?? "0") : "0";
    const pontos = porTerritorio.get(chave) ?? [];
    return montarSerie(analfabetismoUf, pontos, montarUrlIpea("PNADCA_TXA15MUF"));
  },
};

/**
 * Média de anos de estudo — 25 anos ou mais.
 *
 * Nível educacional da população adulta: quanto mais anos, mais escolaridade.
 */
const anosEstudo: Indicador = {
  id: "anos-estudo-25m",
  nome: "Média de anos de estudo — 25 anos ou mais",
  curto: "Anos de estudo 25+",
  categoria: "educacao",
  descricao:
    "Número médio de anos de estudo completados pelas pessoas de 25 anos ou mais — o estoque de " +
    "escolaridade da população adulta. Série anual da PNAD Contínua, de 2016 em diante, sem pontos " +
    "em 2020 e 2021.",
  unidade: ANOS,
  frequencia: "anual",
  desde: 2016,
  direcao: "alto-melhor",
  fonte: "ipea",
  codigo: "IPEADATA PNADCA_NMAE25UF",
  consulta: "https://www.ipeadata.gov.br/ExibeSerie.aspx?serid=2096726940",
  normalizacoes: ANOS_NIVEIS,
  buscar: async ({ signal }) => {
    const pontos = await buscarIpea({
      codigo: "PNADCA_NMAE25UF",
      rotulo: "média de anos de estudo (PNAD Contínua)",
      territorio: "0",
      signal,
    });
    return montarSerie(anosEstudo, pontos, montarUrlIpea("PNADCA_NMAE25UF"));
  },
};

/**
 * Taxa de escolarização — 6 a 14 anos.
 *
 * Fração da faixa etária que frequenta escola, independente da série cursada.
 */
const escolarizacao: Indicador = {
  id: "escolarizacao-6-14",
  nome: "Taxa de escolarização — 6 a 14 anos",
  curto: "Escolarização 6–14",
  categoria: "educacao",
  descricao:
    "Percentual das pessoas de 6 a 14 anos que frequentam escola, qualquer que seja a série — a razão " +
    "entre estudantes e a população da faixa. Série anual da PNAD Contínua, de 2016 em diante, sem " +
    "pontos em 2020 e 2021.",
  unidade: percentual("percentual da população de 6 a 14 anos"),
  frequencia: "anual",
  desde: 2016,
  direcao: "alto-melhor",
  fonte: "ipea",
  codigo: "IPEADATA PNADCA_TXE06_14UF",
  consulta: "https://www.ipeadata.gov.br/ExibeSerie.aspx?serid=2096726947",
  normalizacoes: PCT_VALOR,
  buscar: async ({ signal }) => {
    const pontos = await buscarIpea({
      codigo: "PNADCA_TXE06_14UF",
      rotulo: "taxa de escolarização 6-14 (PNAD Contínua)",
      territorio: "0",
      signal,
    });
    return montarSerie(escolarizacao, pontos, montarUrlIpea("PNADCA_TXE06_14UF"));
  },
};

/**
 * Frequência líquida ao ensino fundamental — 6 a 14 anos.
 *
 * Mais exigente que a escolarização: só conta quem está na série correta.
 * Censos de 1991, 2000 e 2010 — o Censo 2022 ainda não entrou nesta série.
 */
const frequenciaFundamental: Indicador = {
  id: "frequencia-fundamental",
  nome: "Frequência líquida ao ensino fundamental — 6 a 14 anos",
  curto: "Frequência fundamental",
  categoria: "educacao",
  descricao:
    "Percentual das pessoas de 6 a 14 anos que frequentam o ensino fundamental regular seriado, na " +
    "idade correta. Vem do Atlas do Desenvolvimento Humano (Censos Demográficos): um ponto a cada dez " +
    "anos — 1991, 2000 e 2010; o Atlas ainda não incorporou o Censo 2022 a esta série.",
  unidade: percentual("percentual da população de 6 a 14 anos"),
  frequencia: "anual",
  desde: 1991,
  direcao: "alto-melhor",
  fonte: "ipea",
  codigo: "IPEADATA ADH_T_FLFUND",
  consulta: "https://www.ipeadata.gov.br/ExibeSerie.aspx?serid=2096726416",
  normalizacoes: PCT_VALOR,
  snapshot: "atlas-frequencia-fundamental.json",
  buscar: async () =>
    serieDoSnapshot(frequenciaFundamental, "atlas-frequencia-fundamental.json"),
};

export const INDICADORES_EDUCACAO: Indicador[] = [
  analfabetismo,
  analfabetismoUf,
  anosEstudo,
  escolarizacao,
  frequenciaFundamental,
];
