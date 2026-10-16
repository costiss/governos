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

  // Ordem estável: por categoria na ordem editorial, depois por nome.
  const ordem: Categoria[] = [
    "economia",
    "trabalho",
    "social",
    "saude",
    "educacao",
    "seguranca",
    "ambiente",
  ];
  return [...vistos.values()].sort((a, b) => {
    const porCategoria = ordem.indexOf(a.categoria) - ordem.indexOf(b.categoria);
    return porCategoria !== 0 ? porCategoria : a.nome.localeCompare(b.nome, "pt-BR");
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
  Boolean(indicador.porUf && indicador.serieEstadual),
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
