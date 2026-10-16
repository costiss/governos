import { useCallback, useEffect, useState } from "react";
import { gravarLocal, lerLocal } from "@/lib/local";

export type Tema = "ink" | "paper";

const CHAVE = "republica:tema";

/**
 * Dois temas, nenhuma cor. `ink` é tinta sobre papel preto; `paper` é a
 * página impressa. Ambos são monocromáticos — a hierarquia não depende do tema.
 *
 * A leitura do armazenamento é tolerante: se o navegador bloquear, o tema cai
 * no padrão do sistema em vez de derrubar a aplicação.
 */
export function useTema() {
  const [tema, setTema] = useState<Tema>(() => {
    if (typeof window === "undefined") return "ink";
    const salvo = lerLocal(CHAVE);
    if (salvo === "ink" || salvo === "paper") return salvo;
    try {
      return window.matchMedia("(prefers-color-scheme: light)").matches ? "paper" : "ink";
    } catch {
      return "ink";
    }
  });

  useEffect(() => {
    const raiz = document.documentElement;
    raiz.classList.toggle("dark", tema === "ink");
    raiz.classList.toggle("light", tema === "paper");
    gravarLocal(CHAVE, tema);
  }, [tema]);

  const alternar = useCallback(() => {
    setTema((atual) => (atual === "ink" ? "paper" : "ink"));
  }, []);

  return { tema, alternar };
}
