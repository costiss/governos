import type { Ponto } from "@/lib/api/types";
import { buscarJson } from "@/lib/api/http";

/**
 * Adapter da API de Valores do SIDRA (IBGE).
 *
 * A resposta é uma tabela achatada em JSON: a PRIMEIRA linha é um dicionário
 * que nomeia as colunas (`D3C` → "Mês (Código)"), as demais são os dados. Não
 * dá para assumir a posição das colunas — ela muda com o nº de dimensões da
 * consulta. Então o cabeçalho é lido primeiro e a coluna de período é
 * localizada pelo RÓTULO, não pela posição.
 */

export interface ConsultaSidra {
  /** Nº da tabela: "1737". */
  tabela: string;
  /** Nível territorial do IBGE: 1 = Brasil, 3 = UF, 2 = região. */
  nivel: 1 | 2 | 3;
  /** "all" ou o código do local ("1", "35", "3501"...). */
  local?: string;
  /** Código da variável: "63". */
  variavel: string;
  /** "all", "last 12", "2020-2024". */
  periodos?: string;
  /** Classificações extras: { "2": "all" } vira `/c2/all`. */
  classificacoes?: Record<string, string>;
  /** Rótulo humano para mensagens de erro. */
  rotulo: string;
  signal?: AbortSignal;
}

export interface LinhaSidra {
  valor: number;
  /** Código bruto do período, como veio: "202401". */
  periodo: string;
  /** Nome do período, como veio: "janeiro 2024". */
  periodoTitulo: string;
  localCodigo: string;
  localNome: string;
  unidade: string;
}

const BASE = "https://apisidra.ibge.gov.br/values";

export function montarUrlSidra(c: ConsultaSidra): string {
  const partes = [
    `${BASE}/t/${c.tabela}`,
    `n${c.nivel}/${c.local ?? "all"}`,
    `v/${c.variavel}`,
    `p/${c.periodos ?? "all"}`,
  ];
  for (const [classe, categoria] of Object.entries(c.classificacoes ?? {})) {
    partes.push(`c${classe}/${categoria}`);
  }
  return partes.join("/");
}

/** Confere se a consulta é aceita pela tabela (o SIDRA responde 200 com erro em texto). */
function validarResposta(dados: unknown, rotulo: string): unknown[] {
  if (typeof dados === "string") {
    throw new Error(`SIDRA recusou a consulta de ${rotulo}: ${dados}`);
  }
  if (!Array.isArray(dados) || dados.length === 0) {
    throw new Error(`SIDRA não devolveu linhas para ${rotulo}`);
  }
  return dados as unknown[];
}

export async function buscarSidra(c: ConsultaSidra): Promise<LinhaSidra[]> {
  const url = montarUrlSidra(c);
  const dados = await buscarJson<unknown>(url, { rotulo: c.rotulo, signal: c.signal });
  const linhas = validarResposta(dados, c.rotulo);

  const cabecalho = linhas[0] as Record<string, string>;
  const corpo = linhas.slice(1) as Array<Record<string, string>>;

  // A coluna de período é a dimensão cujo rótulo fala de tempo.
  const chavePeriodo = Object.keys(cabecalho).find(
    (chave) => /^D\d+C$/.test(chave) && /m[êe]s|ano|trimestre|per[íi]odo/i.test(cabecalho[chave]),
  );
  if (!chavePeriodo) {
    throw new Error(`Não identifiquei a coluna de período em ${c.rotulo}`);
  }
  // O nome do período é a coluna irmã (D3C → D3N).
  const chavePeriodoTitulo = `${chavePeriodo.slice(0, -1)}N`;

  return corpo
    .map((linha) => ({
      valor: paraNumero(linha.V),
      periodo: String(linha[chavePeriodo] ?? ""),
      periodoTitulo: String(linha[chavePeriodoTitulo] ?? ""),
      localCodigo: String(linha.D1C ?? "1"),
      localNome: String(linha.D1N ?? "Brasil"),
      unidade: String(linha.MN ?? ""),
    }))
    .filter((linha) => Number.isFinite(linha.valor) && linha.periodo !== "");
}

/** "..." e "-" são ausências declaradas pelo IBGE, não zeros. */
function paraNumero(bruto: unknown): number {
  if (bruto == null) return Number.NaN;
  const texto = String(bruto).trim().replace(/\s/g, "");
  if (texto === "" || texto === "..." || texto === "-" || texto === "--" || texto === "..") {
    return Number.NaN;
  }
  const normalizado = texto.includes(",") && !texto.includes(".")
    ? texto.replace(/\./g, "").replace(",", ".")
    : texto.replace(/,/g, "");
  return Number(normalizado);
}

/** Código de período do SIDRA (YYYY, YYYYMM ou YYYYMMDD) → ISO-8601. */
export function periodoParaIso(periodo: string): string | null {
  const limpo = periodo.trim();
  if (/^\d{4}$/.test(limpo)) return `${limpo}-01-01`;
  if (/^\d{6}$/.test(limpo)) return `${limpo.slice(0, 4)}-${limpo.slice(4, 6)}-01`;
  if (/^\d{8}$/.test(limpo)) return `${limpo.slice(0, 4)}-${limpo.slice(4, 6)}-${limpo.slice(6, 8)}`;
  return null;
}

/** Atalho: linhas do SIDRA → pontos de série. */
export function linhasParaPontos(linhas: LinhaSidra[]): Ponto[] {
  const porData = new Map<string, number>();
  for (const linha of linhas) {
    const iso = periodoParaIso(linha.periodo);
    if (!iso) continue;
    // Havendo repetição (mesma data em mais de um recorte), o último vence.
    porData.set(iso, linha.valor);
  }
  return [...porData.entries()]
    .map(([data, valor]) => ({ data, valor }))
    .sort((a, b) => a.data.localeCompare(b.data));
}

/** Códigos das 27 UFs na nomenclatura do IBGE. */
export const CODIGO_UF: Record<string, string> = {
  RO: "11",
  AC: "12",
  AM: "13",
  RR: "14",
  PA: "15",
  AP: "16",
  TO: "17",
  MA: "21",
  PI: "22",
  CE: "23",
  RN: "24",
  PB: "25",
  PE: "26",
  AL: "27",
  SE: "28",
  BA: "29",
  MG: "31",
  ES: "32",
  RJ: "33",
  SP: "35",
  PR: "41",
  SC: "42",
  RS: "43",
  MS: "50",
  MT: "51",
  GO: "52",
  DF: "53",
};

export const UF_POR_CODIGO: Record<string, string> = Object.fromEntries(
  Object.entries(CODIGO_UF).map(([uf, codigo]) => [codigo, uf]),
);
