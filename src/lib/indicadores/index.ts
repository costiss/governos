import type { Categoria } from "@/lib/api/types";
import type { Indicador } from "@/lib/indicadores/tipos";

/**
 * Registro de indicadores.
 *
 * Cada arquivo `./<categoria>.ts` exporta um array de `Indicador`. O registro
 * descobre os módulos sozinho — acrescentar uma categoria é criar um arquivo,
 * sem editar nenhuma lista. `tipos.ts` e `apoio.ts` não exportam arrays de
 * indicadores, então passam incólumes pelo filtro.
 */

type Exportacoes = Record<string, unknown>;

const modulos = import.meta.glob<Exportacoes>("./*.ts", { eager: true });

function ehListaDeIndicadores(valor: unknown): valor is Indicador[] {
  return (
    Array.isArray(valor) &&
    valor.length > 0 &&
    valor.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as Indicador).id === "string" &&
        typeof (item as Indicador).buscar === "function",
    )
  );
}

// Ordem estável: por categoria na ordem editorial, depois por nome.
const ORDEM_CATEGORIAS: Categoria[] = [
  "economia",
  "trabalho",
  "social",
  "saude",
  "educacao",
  "seguranca",
  "ambiente",
];

/**
 * Ordem editorial DENTRO de cada categoria.
 *
 * Sem isto a lista sai alfabética — e "Desocupação" apareceria atrás de
 * "Informalidade", "Massa de rendimento" e "Ocupados", que é o contrário do que
 * quem abre o app procura primeiro. O usuário não deveria ter de garimpar a
 * taxa de desemprego. O que não estiver listado cai no fim, por nome.
 */
const ORDEM: Record<string, number> = {
  // Economia — o que se cita numa discussão de governo, na ordem em que se cita.
  "ipca-12-meses": 1,
  "pib-real": 2,
  "pib-per-capita": 3,
  "selic-meta": 4,
  cambio: 5,
  "divida-liquida": 6,
  "divida-bruta": 7,
  "resultado-primario": 8,
  ipca: 9,
  "selic-mes": 10,
  "reservas-internacionais": 11,
  investimento: 12,
  "taxa-investimento": 13,

  // Trabalho e renda.
  desocupacao: 1,
  "desocupacao-uf": 2,
  caged: 3,
  "salario-minimo-real": 4,
  "rendimento-medio-real": 5,
  "pessoas-ocupadas": 6,
  informalidade: 7,
  "massa-rendimento-real": 8,
  "participacao-forca-trabalho": 9,
  "desocupacao-anual": 10,
  "desocupacao-pnad": 11,
  "informalidade-pnad": 12,

  // Desigualdade e pobreza.
  idh: 1,
  gini: 2,
  "renda-per-capita": 3,
  "pobreza-420": 4,
  "extrema-pobreza": 5,
  "inseguranca-alimentar-grave": 6,
  "inseguranca-alimentar": 7,
  "bolsa-familia-valor": 8,
  "bolsa-familia-beneficios": 9,
  "razao-10-40": 10,
  "pobreza-830": 11,
  "pobreza-300": 12,
  "gini-uf": 13,

  // Saúde.
  "mortalidade-infantil": 1,
  "esperanca-de-vida": 2,
  "leitos-sus": 3,
  "mortalidade-na-infancia": 4,
  "mortalidade-infantil-atlas": 5,
  "esperanca-de-vida-atlas": 6,

  // Educação.
  analfabetismo: 1,
  "anos-estudo-25m": 2,
  "escolarizacao-6-14": 3,
  "frequencia-fundamental": 4,
  "analfabetismo-uf": 5,

  // Segurança e ambiente.
  "taxa-homicidios": 1,
  homicidios: 2,
  "taxa-acidentes-transito": 3,
  "taxa-suicidios": 4,
  "desmatamento-amazonia-legal": 1,
};

const SEM_PREFERENCIA = 10_000;

/**
 * Séries que medem o MESMO conceito em outro período ou por outra fonte.
 *
 * A taxa de desocupação existe em três: PNAD antiga (1992–2014), PNAD Contínua
 * (2012+) e o recorte por UF. Nenhuma cobre 1985 a hoje sozinha. Em vez de
 * emendar metodologias diferentes num gráfico só — o que produziria um degrau
 * disfarçado de fato —, o app mantém as séries separadas e liga uma à outra:
 * quando a comparação escolhida não tem dado, a tela oferece as irmãs.
 *
 * Fica declarado aqui, e não em cada arquivo de categoria, pelo mesmo motivo da
 * ordem editorial: é uma decisão editorial sobre o catálogo, não um atributo
 * do dado.
 */
const ALTERNATIVAS: Record<string, string[]> = {
  desocupacao: ["desocupacao-anual", "desocupacao-pnad", "desocupacao-uf"],
  "desocupacao-anual": ["desocupacao", "desocupacao-pnad"],
  "desocupacao-pnad": ["desocupacao", "desocupacao-anual"],
  "desocupacao-uf": ["desocupacao"],

  informalidade: ["informalidade-pnad"],
  "informalidade-pnad": ["informalidade"],

  "mortalidade-infantil": ["mortalidade-infantil-atlas"],
  "mortalidade-infantil-atlas": ["mortalidade-infantil"],
  "esperanca-de-vida": ["esperanca-de-vida-atlas"],
  "esperanca-de-vida-atlas": ["esperanca-de-vida"],

  "pobreza-300": ["pobreza-420", "pobreza-830"],
  "pobreza-420": ["pobreza-300", "pobreza-830"],
  "pobreza-830": ["pobreza-300", "pobreza-420"],

  // Fome e transferência de renda: as séries irmãs que medem o mesmo fenômeno
  // por ângulos distintos — insegurança alimentar grave e total, valor e número
  // de benefícios do Bolsa Família.
  "inseguranca-alimentar-grave": ["inseguranca-alimentar"],
  "inseguranca-alimentar": ["inseguranca-alimentar-grave"],

  "bolsa-familia-valor": ["bolsa-familia-beneficios"],
  "bolsa-familia-beneficios": ["bolsa-familia-valor"],
};

function posicao(indicador: Indicador): number {
  return ORDEM[indicador.id] ?? SEM_PREFERENCIA;
}

function coletar(): Indicador[] {
  const vistos = new Map<string, Indicador>();
  const arquivos = Object.keys(modulos)
    .filter((caminho) => !/\/(tipos|apoio|index)\.ts$/.test(caminho))
    .sort();

  for (const caminho of arquivos) {
    for (const valor of Object.values(modulos[caminho] ?? {})) {
      if (!ehListaDeIndicadores(valor)) continue;
      for (const indicador of valor) {
        if (vistos.has(indicador.id)) {
          console.warn(`[indicadores] id duplicado ignorado: ${indicador.id} (${caminho})`);
          continue;
        }
        vistos.set(indicador.id, indicador);
      }
    }
  }

  return [...vistos.values()]
    .map((indicador) => {
      const alternativas = ALTERNATIVAS[indicador.id];
      return alternativas ? { ...indicador, alternativas } : indicador;
    })
    .sort((a, b) => {
      const porCategoria =
        ORDEM_CATEGORIAS.indexOf(a.categoria) - ORDEM_CATEGORIAS.indexOf(b.categoria);
      if (porCategoria !== 0) return porCategoria;
      const porPosicao = posicao(a) - posicao(b);
      return porPosicao !== 0 ? porPosicao : a.nome.localeCompare(b.nome, "pt-BR");
    });
}

export const INDICADORES: Indicador[] = coletar();

const porId = new Map(INDICADORES.map((indicador) => [indicador.id, indicador]));

export function indicadorPorId(id: string | null | undefined): Indicador | undefined {
  return id ? porId.get(id) : undefined;
}

/** Indicadores que aceitam recorte por UF. */
export const INDICADORES_POR_UF = INDICADORES.filter((indicador) => indicador.porUf);

/** Indicadores com série estadual numa chamada só — os que podem ir ao mapa. */
export const INDICADORES_MAPEAVEIS = INDICADORES.filter((indicador) =>
  Boolean(indicador.porUf && (indicador.snapshot || indicador.serieEstadual)),
);

export function porCategoria(): Array<{ categoria: Categoria; indicadores: Indicador[] }> {
  const grupos = new Map<Categoria, Indicador[]>();
  for (const indicador of INDICADORES) {
    const lista = grupos.get(indicador.categoria) ?? [];
    lista.push(indicador);
    grupos.set(indicador.categoria, lista);
  }
  return [...grupos.entries()].map(([categoria, indicadores]) => ({ categoria, indicadores }));
}
