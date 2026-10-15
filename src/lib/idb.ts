/**
 * Storage assíncrono mínimo em IndexedDB, no formato que o persister do
 * TanStack Query espera. Escrito à mão (≈60 linhas) para não puxar uma
 * dependência inteira só por um key/value store.
 *
 * Motivação: o cache precisa sobreviver ao fechamento da aba. É isso que
 * impede que cada visita nova volte a bater nas APIs oficiais.
 */

export interface Armazenamento {
  getItem: (chave: string) => Promise<string | null>;
  setItem: (chave: string, valor: string) => Promise<void>;
  removeItem: (chave: string) => Promise<void>;
}

const BANCO = "republica";
const LOJA = "kv";
const VERSAO = 1;

let promessaDb: Promise<IDBDatabase> | null = null;

function abrirBanco(): Promise<IDBDatabase> {
  if (promessaDb) return promessaDb;

  promessaDb = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB indisponível neste ambiente"));
      return;
    }
    const requisicao = indexedDB.open(BANCO, VERSAO);
    requisicao.onupgradeneeded = () => {
      const db = requisicao.result;
      if (!db.objectStoreNames.contains(LOJA)) db.createObjectStore(LOJA);
    };
    requisicao.onsuccess = () => resolve(requisicao.result);
    requisicao.onerror = () => reject(requisicao.error);
  });

  return promessaDb;
}

function transacionar<T>(
  modo: IDBTransactionMode,
  operacao: (loja: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return abrirBanco().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(LOJA, modo);
        const requisicao = operacao(tx.objectStore(LOJA));
        requisicao.onsuccess = () => resolve(requisicao.result);
        requisicao.onerror = () => reject(requisicao.error);
        tx.onabort = () => reject(tx.error);
      }),
  );
}

/** Versão em memória — usada quando IndexedDB não existe (SSR, modo privado). */
function emMemoria(): Armazenamento {
  const mapa = new Map<string, string>();
  return {
    getItem: async (c) => mapa.get(c) ?? null,
    setItem: async (c, v) => void mapa.set(c, v),
    removeItem: async (c) => void mapa.delete(c),
  };
}

export function criarArmazenamento(): Armazenamento {
  if (typeof indexedDB === "undefined") return emMemoria();

  return {
    async getItem(chave) {
      try {
        const valor = await transacionar<string | undefined>("readonly", (loja) =>
          loja.get(chave),
        );
        return valor ?? null;
      } catch {
        return null;
      }
    },
    async setItem(chave, valor) {
      try {
        await transacionar("readwrite", (loja) => loja.put(valor, chave));
      } catch {
        /* cota estourada ou aba anônima: seguir sem persistir é aceitável */
      }
    },
    async removeItem(chave) {
      try {
        await transacionar("readwrite", (loja) => loja.delete(chave));
      } catch {
        /* idem */
      }
    },
  };
}
