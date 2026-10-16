import type { Indicador } from "@/lib/indicadores/tipos";
import { montarSerie } from "@/lib/indicadores/tipos";
import type { Ponto } from "@/lib/api/types";
import type { ConsultaSidra } from "@/lib/api/sidra";
import { buscarSidra, linhasParaPontos, montarUrlSidra } from "@/lib/api/sidra";
import { buscarIpea, montarUrlIpea } from "@/lib/api/ipea";
import { buscarBcb, montarUrlBcb } from "@/lib/api/bcb";
import { paraIso } from "@/lib/serie";

/**
 * Economia — preços, atividade, juros, câmbio, dívida e contas externas.
 *
 * Todas as séries vêm de fontes oficiais: IBGE (SIDRA), Ipea Data e Banco
 * Central (SGS). Nenhuma passa por terceiros. As unidades são declaradas por
 * extenso porque "1,99" sem unidade não diz nada.
 */

/** Página humana do SGS, onde qualquer série pode ser conferida pelo número. */
const PAGINA_SGS =
  "https://www3.bcb.gov.br/sgspub/localizarseries/localizarSeries.do?method=prepararTelaLocalizarSeries";
/** Tabela 1737 do SIDRA (IPCA) na interface de consulta. */
const PAGINA_SIDRA = "https://sidra.ibge.gov.br/tabela/1737";
/** URL do Ipea Data que devolve os valores do PIB (FMI/WEO). */
const URL_IPEA_WEO = montarUrlIpea("WEO_PIBRWEOBRA");

const DIA_MS = 86_400_000;
/** Folga sob o teto de 10 anos que o SGS impõe às séries diárias. */
const ANOS_POR_JANELA = 9;

function hojeIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Séries diárias do SGS recusam consultas com janela maior que 10 anos. Para
 * cobrir décadas, o intervalo é fatiado em blocos contíguos e os pontos são
 * costurados — cada fatia é uma chamada válida ao mesmo adapter.
 */
async function pontosDeSerieDiaria(
  codigo: number,
  de: string,
  rotulo: string,
  signal?: AbortSignal,
): Promise<Ponto[]> {
  const fim = new Date(`${hojeIso()}T00:00:00Z`);
  let inicio = new Date(`${de}T00:00:00Z`);
  const coletados: Ponto[] = [];

  while (inicio <= fim) {
    const limite = new Date(
      Date.UTC(inicio.getUTCFullYear() + ANOS_POR_JANELA, inicio.getUTCMonth(), inicio.getUTCDate()),
    );
    const ate = limite < fim ? limite : fim;
    coletados.push(
      ...(await buscarBcb({ codigo, de: paraIso(inicio), ate: paraIso(ate), rotulo, signal })),
    );
    inicio = new Date(ate.getTime() + DIA_MS);
  }

  // As fatias já são contíguas; o dedup só protege a borda entre elas.
  const porData = new Map<string, number>();
  for (const ponto of coletados) porData.set(ponto.data, ponto.valor);
  return [...porData.entries()]
    .map(([data, valor]) => ({ data, valor }))
    .sort((a, b) => a.data.localeCompare(b.data));
}

// ─────────────────────────────────────────────────────────────────────────────
// Atividade e preços
// ─────────────────────────────────────────────────────────────────────────────

const pibReal: Indicador = {
  id: "pib-real",
  nome: "Produto Interno Bruto — variação real anual",
  curto: "PIB real",
  categoria: "economia",
  descricao:
    "Crescimento real do PIB em relação ao ano anterior. Série compilada pelo FMI no World Economic Outlook e publicada pelo Ipea; revisões periódicas podem alterar anos já divulgados, por isso o último período é marcado como revisável.",
  unidade: {
    simbolo: "%",
    nome: "variação real anual do PIB",
    casas: 2,
    sufixo: " % a.a.",
  },
  frequencia: "anual",
  desde: 1980,
  direcao: "alto-melhor",
  fonte: "ipea",
  codigo: "Ipea WEO_PIBRWEOBRA (FMI/WEO)",
  consulta: URL_IPEA_WEO,
  normalizacoes: ["absoluto"],
  buscar: async (opcoes) => {
    const pontos = await buscarIpea({
      codigo: "WEO_PIBRWEOBRA",
      rotulo: "PIB — variação real anual",
      signal: opcoes.signal,
    });
    return montarSerie(pibReal, pontos, URL_IPEA_WEO, { revisavel: true });
  },
};

const CONSULTA_IPCA_MENSAL: ConsultaSidra = {
  tabela: "1737",
  nivel: 1,
  local: "all",
  variavel: "63",
  periodos: "all",
  rotulo: "IPCA — variação mensal",
};

const ipcaMensal: Indicador = {
  id: "ipca",
  nome: "IPCA — variação mensal",
  curto: "IPCA",
  categoria: "economia",
  descricao:
    "Variação do Índice Nacional de Preços ao Consumidor Amplo no mês — o índice oficial de inflação, que serve de referência para a meta do Banco Central.",
  unidade: {
    simbolo: "%",
    nome: "inflação do mês",
    casas: 2,
    sufixo: " %",
  },
  frequencia: "mensal",
  desde: 1980,
  direcao: null,
  fonte: "ibge",
  codigo: "SIDRA t.1737, v.63",
  consulta: PAGINA_SIDRA,
  normalizacoes: ["absoluto"],
  buscar: async (opcoes) => {
    const linhas = await buscarSidra({ ...CONSULTA_IPCA_MENSAL, signal: opcoes.signal });
    return montarSerie(ipcaMensal, linhasParaPontos(linhas), montarUrlSidra(CONSULTA_IPCA_MENSAL));
  },
};

const CONSULTA_IPCA_12_MESES: ConsultaSidra = {
  tabela: "1737",
  nivel: 1,
  local: "all",
  variavel: "2265",
  periodos: "all",
  rotulo: "IPCA — acumulado em 12 meses",
};

const ipcaDozeMeses: Indicador = {
  id: "ipca-12-meses",
  nome: "IPCA — acumulado em 12 meses",
  curto: "IPCA 12 meses",
  categoria: "economia",
  descricao:
    "Inflação acumulada nos últimos doze meses. É a medida que o Banco Central persegue ao fixar a meta de inflação, porque filtra o ruído mensal.",
  unidade: {
    simbolo: "%",
    nome: "inflação acumulada em 12 meses",
    casas: 2,
    sufixo: " %",
  },
  frequencia: "mensal",
  desde: 1980,
  direcao: null,
  fonte: "ibge",
  codigo: "SIDRA t.1737, v.2265",
  consulta: PAGINA_SIDRA,
  normalizacoes: ["absoluto"],
  buscar: async (opcoes) => {
    const linhas = await buscarSidra({ ...CONSULTA_IPCA_12_MESES, signal: opcoes.signal });
    return montarSerie(
      ipcaDozeMeses,
      linhasParaPontos(linhas),
      montarUrlSidra(CONSULTA_IPCA_12_MESES),
    );
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Juros
// ─────────────────────────────────────────────────────────────────────────────

const selicMeta: Indicador = {
  id: "selic-meta",
  nome: "Taxa Selic — meta definida pelo Copom",
  curto: "Meta Selic",
  categoria: "economia",
  descricao:
    "Meta da taxa básica de juros fixada pelo Comitê de Política Monetária (Copom) a cada reunião, em % ao ano. Vale até a reunião seguinte — por isso a série é um degrau.",
  unidade: {
    simbolo: "%",
    nome: "meta da taxa Selic",
    casas: 2,
    sufixo: " % a.a.",
  },
  frequencia: "diaria",
  desde: 1999,
  direcao: null,
  fonte: "bcb",
  codigo: "BCB SGS 432",
  consulta: PAGINA_SGS,
  normalizacoes: ["absoluto"],
  buscar: async (opcoes) => {
    const pontos = await pontosDeSerieDiaria(432, "1999-03-05", "Selic — meta do Copom", opcoes.signal);
    return montarSerie(selicMeta, pontos, PAGINA_SGS);
  },
};

const selicAcumuladaMes: Indicador = {
  id: "selic-mes",
  nome: "Taxa Selic — acumulada no mês",
  curto: "Selic no mês",
  categoria: "economia",
  descricao:
    "Rentabilidade acumulada da taxa Selic efetiva no mês (juros compostos sobre a taxa diária). É a leitura mensal do juro básico.",
  unidade: {
    simbolo: "%",
    nome: "Selic acumulada no mês",
    casas: 2,
    sufixo: " % no mês",
  },
  frequencia: "mensal",
  desde: 1986,
  direcao: null,
  fonte: "bcb",
  codigo: "BCB SGS 4390",
  consulta: PAGINA_SGS,
  normalizacoes: ["absoluto"],
  buscar: async (opcoes) => {
    const de = "1986-08-01";
    const rotulo = "Selic acumulada no mês";
    const pontos = await buscarBcb({ codigo: 4390, de, rotulo, signal: opcoes.signal });
    return montarSerie(selicAcumuladaMes, pontos, montarUrlBcb({ codigo: 4390, de, rotulo }));
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Câmbio, dívida e contas externas
// ─────────────────────────────────────────────────────────────────────────────

const cambio: Indicador = {
  id: "cambio",
  nome: "Câmbio comercial — dólar (venda, fim de período)",
  curto: "Dólar",
  categoria: "economia",
  descricao:
    "Cotação do dólar americano para venda no fim do mês, no mercado comercial. Atenção: até junho de 1994 os valores estão na moeda vigente de cada período (cruzeiro, cruzado, cruzado novo, cruzeiro real) — cada reforma monetária aparece como queda abrupta na série; a partir de julho de 1994, em reais por dólar.",
  unidade: {
    simbolo: "R$/US$",
    nome: "moeda nacional por dólar americano (comercial, venda, fim de período)",
    casas: 4,
  },
  frequencia: "mensal",
  desde: 1953,
  direcao: null,
  fonte: "bcb",
  codigo: "BCB SGS 3697",
  consulta: PAGINA_SGS,
  normalizacoes: ["absoluto", "base100"],
  buscar: async (opcoes) => {
    const de = "1953-02-01";
    const rotulo = "Câmbio comercial (venda)";
    const pontos = await buscarBcb({ codigo: 3697, de, rotulo, signal: opcoes.signal });
    return montarSerie(cambio, pontos, montarUrlBcb({ codigo: 3697, de, rotulo }));
  },
};

const dividaLiquida: Indicador = {
  id: "divida-liquida",
  nome: "Dívida líquida do setor público",
  curto: "Dívida líquida",
  categoria: "economia",
  descricao:
    "Dívida líquida do setor público consolidado como proporção do PIB. Desconta os ativos financeiros do próprio setor público — é o estoque da dívida que os governos deixam de herança.",
  unidade: {
    simbolo: "%",
    nome: "dívida líquida do setor público (% do PIB)",
    casas: 2,
    sufixo: " % do PIB",
  },
  frequencia: "mensal",
  desde: 2001,
  direcao: "baixo-melhor",
  fonte: "bcb",
  codigo: "BCB SGS 4513",
  consulta: PAGINA_SGS,
  normalizacoes: ["absoluto"],
  buscar: async (opcoes) => {
    const de = "2001-12-01";
    const rotulo = "Dívida líquida do setor público (% do PIB)";
    const pontos = await buscarBcb({ codigo: 4513, de, rotulo, signal: opcoes.signal });
    return montarSerie(dividaLiquida, pontos, montarUrlBcb({ codigo: 4513, de, rotulo }));
  },
};

const dividaBruta: Indicador = {
  id: "divida-bruta",
  nome: "Dívida bruta do governo geral",
  curto: "Dívida bruta",
  categoria: "economia",
  descricao:
    "Dívida bruta do governo geral (União, estados e municípios) como proporção do PIB, na metodologia do Banco Central adotada a partir de 2008. Difere da dívida líquida porque NÃO abate os ativos financeiros do próprio setor público (créditos, reservas, títulos em poder de outros órgãos): por isso é sempre maior e reage menos às variações do câmbio e das reservas.",
  unidade: {
    simbolo: "%",
    nome: "dívida bruta do governo geral (% do PIB)",
    casas: 2,
    sufixo: " % do PIB",
  },
  frequencia: "mensal",
  desde: 2006,
  direcao: "baixo-melhor",
  fonte: "bcb",
  codigo: "BCB SGS 13762",
  consulta: PAGINA_SGS,
  normalizacoes: ["absoluto"],
  buscar: async (opcoes) => {
    const de = "2006-12-01";
    const rotulo = "Dívida bruta do governo geral (% do PIB)";
    const pontos = await buscarBcb({ codigo: 13762, de, rotulo, signal: opcoes.signal });
    return montarSerie(dividaBruta, pontos, montarUrlBcb({ codigo: 13762, de, rotulo }));
  },
};

const reservas: Indicador = {
  id: "reservas-internacionais",
  nome: "Reservas internacionais",
  curto: "Reservas",
  categoria: "economia",
  descricao:
    "Estoque de reservas internacionais do Banco Central ao fim do mês, em milhões de dólares. São o colchão contra crises cambiais e o grau de exposição externa do país.",
  unidade: {
    simbolo: "US$",
    nome: "reservas internacionais (milhões de dólares)",
    casas: 0,
    prefixo: "US$ ",
    sufixo: " mi",
  },
  frequencia: "mensal",
  desde: 1971,
  direcao: null,
  fonte: "bcb",
  codigo: "BCB SGS 3546",
  consulta: PAGINA_SGS,
  normalizacoes: ["absoluto", "base100"],
  buscar: async (opcoes) => {
    const de = "1971-01-01";
    const rotulo = "Reservas internacionais (US$ milhões)";
    const pontos = await buscarBcb({ codigo: 3546, de, rotulo, signal: opcoes.signal });
    return montarSerie(reservas, pontos, montarUrlBcb({ codigo: 3546, de, rotulo }));
  },
};

const resultadoPrimario: Indicador = {
  id: "resultado-primario",
  nome: "Resultado primário do setor público",
  curto: "Resultado primário",
  categoria: "economia",
  descricao:
    "Resultado primário do setor público consolidado como proporção do PIB — receitas menos despesas antes do pagamento de juros. Superávit reduz a necessidade de financiamento; déficit a aumenta.",
  unidade: {
    simbolo: "%",
    nome: "resultado primário (% do PIB)",
    casas: 2,
    sufixo: " % do PIB",
  },
  frequencia: "mensal",
  desde: 1998,
  direcao: "alto-melhor",
  fonte: "bcb",
  codigo: "BCB SGS 5722",
  consulta: PAGINA_SGS,
  normalizacoes: ["absoluto"],
  buscar: async (opcoes) => {
    const de = "1998-12-01";
    const rotulo = "Resultado primário do setor público (% do PIB)";
    const pontos = await buscarBcb({ codigo: 5722, de, rotulo, signal: opcoes.signal });
    return montarSerie(resultadoPrimario, pontos, montarUrlBcb({ codigo: 5722, de, rotulo }));
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Investimento
// ─────────────────────────────────────────────────────────────────────────────

/** URL verificável da FBCF no Ipea Data (Contas Nacionais do IBGE). */
const URL_IPEA_FBCF = montarUrlIpea("SCN104_FBKFG104");
/** URL verificável da taxa de investimento no Ipea Data. */
const URL_IPEA_TAXA_INVESTIMENTO = montarUrlIpea("PAN_FBKFPIBV");

const investimento: Indicador = {
  id: "investimento",
  nome: "Formação bruta de capital fixo — variação real",
  curto: "Investimento (FBCF)",
  categoria: "economia",
  descricao:
    "Variação real (volume) da formação bruta de capital fixo — máquinas, equipamentos, construção e outros ativos fixos — em relação ao mesmo trimestre do ano anterior. É o investimento produtivo medido pelas Contas Nacionais do IBGE.",
  unidade: {
    simbolo: "%",
    nome: "variação real sobre o mesmo trimestre do ano anterior",
    casas: 2,
    sufixo: " %",
  },
  frequencia: "trimestral",
  desde: 1996,
  direcao: "alto-melhor",
  fonte: "ipea",
  codigo: "Ipea Data SCN104_FBKFG104 (IBGE/SCN)",
  consulta: URL_IPEA_FBCF,
  normalizacoes: ["absoluto"],
  buscar: async (opcoes) => {
    const pontos = await buscarIpea({
      codigo: "SCN104_FBKFG104",
      rotulo: "Formação bruta de capital fixo — variação real",
      signal: opcoes.signal,
    });
    return montarSerie(investimento, pontos, URL_IPEA_FBCF, { revisavel: true });
  },
};

const taxaInvestimento: Indicador = {
  id: "taxa-investimento",
  nome: "Taxa de investimento — formação bruta de capital fixo (% do PIB)",
  curto: "Taxa de investimento",
  categoria: "economia",
  descricao:
    "Formação bruta de capital fixo como proporção do PIB a preços correntes: quanto da produção do país é destinado a investimento. É a leitura em nível do esforço de investimento, complementar à variação real trimestral.",
  unidade: {
    simbolo: "%",
    nome: "formação bruta de capital fixo (% do PIB)",
    casas: 2,
    sufixo: " % do PIB",
  },
  frequencia: "anual",
  desde: 1996,
  direcao: "alto-melhor",
  fonte: "ipea",
  codigo: "Ipea Data PAN_FBKFPIBV (IBGE/SCN)",
  consulta: URL_IPEA_TAXA_INVESTIMENTO,
  normalizacoes: ["absoluto"],
  buscar: async (opcoes) => {
    const pontos = await buscarIpea({
      codigo: "PAN_FBKFPIBV",
      rotulo: "Taxa de investimento nominal",
      signal: opcoes.signal,
    });
    return montarSerie(taxaInvestimento, pontos, URL_IPEA_TAXA_INVESTIMENTO, { revisavel: true });
  },
};

export const INDICADORES_ECONOMIA: Indicador[] = [
  pibReal,
  ipcaMensal,
  ipcaDozeMeses,
  selicMeta,
  selicAcumuladaMes,
  cambio,
  dividaLiquida,
  dividaBruta,
  reservas,
  resultadoPrimario,
  investimento,
  taxaInvestimento,
];
