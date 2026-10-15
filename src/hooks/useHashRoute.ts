import { useCallback, useEffect, useState } from "react";

/**
 * Roteamento por hash, com filtros na própria URL.
 *
 * Toda tela é linkável: os parâmetros vivem no `#`, então um recorte
 * ("Lula I vs Bolsonaro, IPCA, per capita") é um endereço que se compartilha.
 * Sem dependência de router — a superfície é pequena o bastante.
 */

export interface Rota {
  /** Primeiro segmento do hash: `geral`, `comparar`, `mapa`… */
  nome: string;
  /** Pares chave/valor da query do hash. */
  params: URLSearchParams;
}

function lerHash(): Rota {
  const bruto = window.location.hash.replace(/^#\/?/, "");
  const [caminho, query = ""] = bruto.split("?");
  return {
    nome: caminho || "geral",
    params: new URLSearchParams(query),
  };
}

function igual(a: Rota, b: Rota): boolean {
  if (a.nome !== b.nome) return false;
  const pa = [...a.params.entries()].sort().map(String);
  const pb = [...b.params.entries()].sort().map(String);
  return pa.length === pb.length && pa.every((valor, i) => valor === pb[i]);
}

export function useHashRoute() {
  const [rota, setRota] = useState<Rota>(() =>
    typeof window === "undefined" ? { nome: "geral", params: new URLSearchParams() } : lerHash(),
  );

  useEffect(() => {
    const aoMudar = () => {
      const proxima = lerHash();
      setRota((atual) => (igual(atual, proxima) ? atual : proxima));
    };
    window.addEventListener("hashchange", aoMudar);
    if (!window.location.hash) window.location.hash = "#/geral";
    return () => window.removeEventListener("hashchange", aoMudar);
  }, []);

  const ir = useCallback((nome: string, params?: Record<string, string | null | undefined>) => {
    const busca = new URLSearchParams();
    for (const [chave, valor] of Object.entries(params ?? {})) {
      if (valor != null && valor !== "") busca.set(chave, valor);
    }
    const query = busca.toString();
    window.location.hash = `#/${nome}${query ? `?${query}` : ""}`;
  }, []);

  const definirParam = useCallback(
    (chave: string, valor: string | null) => {
      const proxima = new URLSearchParams(window.location.hash.split("?")[1] ?? "");
      if (valor == null || valor === "") proxima.delete(chave);
      else proxima.set(chave, valor);
      const caminho = window.location.hash.replace(/^#\/?/, "").split("?")[0] || "geral";
      const query = proxima.toString();
      window.location.hash = `#/${caminho}${query ? `?${query}` : ""}`;
    },
    [],
  );

  return { rota, ir, definirParam };
}
