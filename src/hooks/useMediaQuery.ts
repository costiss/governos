import { useEffect, useState } from "react";

/**
 * Consulta uma media query e reage a mudanças.
 *
 * Usado onde a diferença não é só de estilo — o mapa, por exemplo, precisa
 * saber se deve desenhar as caixas de chamada dos estados pequenos, e CSS não
 * consegue remover geometria do SVG.
 */
export function useMediaQuery(query: string): boolean {
  const [corresponde, definirCorresponde] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const consulta = window.matchMedia(query);
    const aoMudar = (evento: MediaQueryListEvent) => definirCorresponde(evento.matches);
    definirCorresponde(consulta.matches);
    consulta.addEventListener("change", aoMudar);
    return () => consulta.removeEventListener("change", aoMudar);
  }, [query]);

  return corresponde;
}

/** `true` quando o sistema pede menos movimento. */
export function useMovimentoReduzido(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}
