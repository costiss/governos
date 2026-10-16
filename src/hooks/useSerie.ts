import { useQuery } from "@tanstack/react-query";
import type { Ponto, Serie } from "@/lib/api/types";
import type { Indicador, OpcoesBusca } from "@/lib/indicadores/tipos";
import { buscarPib, buscarPopulacao, buscarPopulacaoPorUf } from "@/lib/indicadores/apoio";
import { buscarIpeaPorTerritorio } from "@/lib/api/ipea";
import { TTL_CONSOLIDADO, TTL_CORRENTE } from "@/lib/queryClient";

/**
 * Hooks de leitura. Todos delegam ao TanStack Query, que é quem garante a
 * cortesia com as APIs públicas: uma série é buscada UMA vez, guardada na
 * memória do app e persistida em IndexedDB. Trocar de visão, reabrir a aba ou
 * voltar amanhã não gera tráfego novo.
 */

function chave(indicador: Indicador, uf?: string) {
  return ["serie", indicador.id, uf ?? "BR"] as const;
}

/**
 * Série principal de um indicador. O `staleTime` é longo porque histórico de
 * governo não muda; o mês corrente é a exceção, e aí a validade cai para horas.
 */
export function useSerie(indicador: Indicador | undefined, uf?: string) {
  return useQuery({
    queryKey: indicador ? chave(indicador, uf) : ["serie", "vazio"],
    enabled: Boolean(indicador),
    staleTime: recente(indicador) ? TTL_CORRENTE : TTL_CONSOLIDADO,
    queryFn: ({ signal }) => indicador!.buscar({ uf, signal } satisfies OpcoesBusca),
    select: (serie: Serie) => serie,
  });
}

/** O último ponto é do ano/mês corrente? Então a série ainda pode ser revisada. */
function recente(indicador: Indicador | undefined): boolean {
  if (!indicador) return false;
  return indicador.frequencia !== "anual";
}

/** Denominadores para normalização. Compartilhados por toda a aplicação. */
export function useApoio() {
  const populacao = useQuery({
    queryKey: ["apoio", "populacao"],
    queryFn: ({ signal }) => buscarPopulacao(signal),
    staleTime: TTL_CONSOLIDADO,
  });

  const pib = useQuery({
    queryKey: ["apoio", "pib"],
    queryFn: ({ signal }) => buscarPib(signal),
    staleTime: TTL_CONSOLIDADO,
  });

  return {
    populacao: populacao.data ?? ([] as Ponto[]),
    pib: pib.data ?? ([] as Ponto[]),
    carregando: populacao.isLoading || pib.isLoading,
  };
}

export function usePopulacaoPorUf() {
  return useQuery({
    queryKey: ["apoio", "populacao-uf"],
    queryFn: ({ signal }) => buscarPopulacaoPorUf(signal),
    staleTime: TTL_CONSOLIDADO,
  });
}

/**
 * Valores mais recentes por UF, para o mapa. Só funciona em indicadores cuja
 * série é estadual no Ipea (campo `TERCODIGO`).
 */
export function useEstados(indicador: Indicador | undefined, codigoIpea: string | undefined) {
  return useQuery({
    queryKey: ["estados", indicador?.id, codigoIpea],
    enabled: Boolean(indicador && codigoIpea),
    staleTime: TTL_CONSOLIDADO,
    queryFn: ({ signal }) =>
      buscarIpeaPorTerritorio({ codigo: codigoIpea!, rotulo: indicador!.nome, signal }),
  });
}
