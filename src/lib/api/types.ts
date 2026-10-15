/** Órgãos que publicam os dados usados no app. Só fontes oficiais. */
export type Fonte = "ibge" | "ipea" | "bcb" | "inep" | "datasus" | "inpe";

export interface FonteRef {
  sigla: string; // "IBGE"
  orgao: string; // "Instituto Brasileiro de Geografia e Estatística"
  api: string; // URL base consultada
  /** Onde conferir o dado na mão. */
  consulta: string;
}

export const FONTES: Record<Fonte, FonteRef> = {
  ibge: {
    sigla: "IBGE",
    orgao: "Instituto Brasileiro de Geografia e Estatística",
    api: "https://apisidra.ibge.gov.br",
    consulta: "https://sidra.ibge.gov.br",
  },
  ipea: {
    sigla: "Ipea",
    orgao: "Instituto de Pesquisa Econômica Aplicada",
    api: "https://www.ipeadata.gov.br/api/odata4",
    consulta: "https://www.ipeadata.gov.br",
  },
  bcb: {
    sigla: "BCB",
    orgao: "Banco Central do Brasil",
    api: "https://api.bcb.gov.br/dados/serie",
    consulta: "https://www3.bcb.gov.br/sgspub/localizarseries/localizarSeries.do",
  },
  inep: {
    sigla: "INEP",
    orgao: "Instituto Nacional de Estudos e Pesquisas Educacionais",
    api: "https://www.gov.br/inep",
    consulta: "https://www.gov.br/inep",
  },
  datasus: {
    sigla: "DATASUS",
    orgao: "Departamento de Informática do SUS",
    api: "https://datasus.saude.gov.br",
    consulta: "https://datasus.saude.gov.br",
  },
  inpe: {
    sigla: "INPE",
    orgao: "Instituto Nacional de Pesquisas Espaciais",
    api: "http://terrabrasilis.dpi.inpe.br",
    consulta: "http://terrabrasilis.dpi.inpe.br",
  },
};

export type Frequencia = "diaria" | "mensal" | "trimestral" | "anual";

/**
 * Unidade é texto explícito — nunca inferida. O app mostra o número sempre com
 * a unidade colada, porque "1,99" sem unidade é ruído.
 */
export interface Unidade {
  /** Símbolo curto: "%", "R$", "hab.", "km²". */
  simbolo: string;
  /** Leitura por extenso: "variação percentual em 12 meses". */
  nome: string;
  /** Casas decimais na exibição. */
  casas: number;
  /** Prefixo ("R$ ") e sufixo (" %") na renderização. */
  prefixo?: string;
  sufixo?: string;
  /** Escala: multiplica o valor bruto (ex.: BCB entrega % ao dia → 1). */
  escala?: number;
}

export interface Ponto {
  /** Instante do dado em ISO-8601. Mensal → dia 1; anual → 1º de janeiro. */
  data: string;
  valor: number;
  /** Recorte territorial (sigla da UF) quando houver. Ausente = Brasil. */
  uf?: string;
}

export interface Serie {
  indicadorId: string;
  pontos: Ponto[];
  frequencia: Frequencia;
  unidade: Unidade;
  fonte: Fonte;
  /** Procedência visível: a URL exata que foi consultada. */
  url: string;
  /** Código de origem (tabela SIDRA, nº SGS, SERCODIGO Ipea). */
  codigo: string;
  /** O período mais recente ainda pode ser revisado pelo órgão. */
  revisavel?: boolean;
}

/** Normalizações aplicáveis a um indicador, alternáveis pelo usuário. */
export type Normalizacao = "absoluto" | "base100" | "perCapita" | "pib";

export const NORMALIZACOES: Record<Normalizacao, { rotulo: string; descricao: string }> = {
  absoluto: { rotulo: "Valor", descricao: "O número como publicado pelo órgão" },
  base100: {
    rotulo: "Base 100",
    descricao: "Índice: 100 no início do recorte — compara ritmos, não tamanhos",
  },
  perCapita: { rotulo: "Per capita", descricao: "Dividido pela população residente" },
  pib: { rotulo: "% do PIB", descricao: "Dividido pelo PIB nominal do período" },
};

export type Categoria =
  | "economia"
  | "trabalho"
  | "social"
  | "saude"
  | "educacao"
  | "seguranca"
  | "ambiente";

export const CATEGORIAS: Record<Categoria, { nome: string; descricao: string }> = {
  economia: { nome: "Economia", descricao: "Preços, atividade, juros e dívida pública" },
  trabalho: { nome: "Trabalho e renda", descricao: "Emprego, desocupação e rendimento" },
  social: { nome: "Desigualdade e pobreza", descricao: "Distribuição de renda e pobreza" },
  saude: { nome: "Saúde", descricao: "Mortalidade, cobertura e atenção básica" },
  educacao: { nome: "Educação", descricao: "Alfabetização, aprendizagem e matrícula" },
  seguranca: { nome: "Segurança", descricao: "Mortalidade violenta" },
  ambiente: { nome: "Meio ambiente", descricao: "Desmatamento e emissões" },
};
