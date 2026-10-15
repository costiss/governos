import { QueryClient } from "@tanstack/react-query";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { criarArmazenamento } from "@/lib/idb";

/**
 * Política de cache — o contrato que protege as APIs públicas.
 *
 * Séries históricas de governo NÃO mudam: o IPCA de março de 1994 é o mesmo
 * hoje e amanhã. Então `staleTime` é longo de propósito e a aplicação nunca
 * refaz uma leitura por foco de janela ou reconexão. A atualização acontece
 * quando — e só quando — o dado é sabidamente recente e alguém pediu por isso.
 */

/** Dados consolidados (até ontem): 30 dias de validade. */
export const TTL_CONSOLIDADO = 1000 * 60 * 60 * 24 * 30;

/** Dados que ainda podem ser revisados (mês corrente): 6 horas. */
export const TTL_CORRENTE = 1000 * 60 * 60 * 6;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: TTL_CONSOLIDADO,
      gcTime: 1000 * 60 * 60 * 24 * 90, // 90 dias na memória
      retry: 2,
      retryDelay: (tentativa) => Math.min(1_000 * 2 ** tentativa, 15_000),
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      networkMode: "offlineFirst",
    },
  },
});

export const armazenamento = criarArmazenamento();

export const persister = createAsyncStoragePersister({
  storage: armazenamento,
  key: "republica:cache:v1",
  throttleTime: 1_500,
});

/** Invalida o cache persistido quando o formato dos dados muda. */
export const VERSAO_CACHE = "1";
