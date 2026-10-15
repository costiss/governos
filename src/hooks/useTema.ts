import { useCallback, useEffect, useState } from "react";

export type Tema = "ink" | "paper";

const CHAVE = "republica:tema";

/**
 * Dois temas, nenhuma cor. `ink` é tinta sobre papel preto; `paper` é a
 * página impressa. Ambos são monocromáticos — a hierarquia não depende do tema.
 */
export function useTema() {
  const [tema, setTema] = useState<Tema>(() => {
    if (typeof window === "undefined") return "ink";
    const salvo = window.localStorage.getItem(CHAVE);
    if (salvo === "ink" || salvo === "paper") return salvo;
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "paper" : "ink";
  });

  useEffect(() => {
    const raiz = document.documentElement;
    raiz.classList.toggle("dark", tema === "ink");
    raiz.classList.toggle("light", tema === "paper");
    window.localStorage.setItem(CHAVE, tema);
  }, [tema]);

  const alternar = useCallback(() => {
    setTema((atual) => (atual === "ink" ? "paper" : "ink"));
  }, []);

  return { tema, alternar };
}
