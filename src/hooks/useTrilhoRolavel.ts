import { useCallback, useEffect, useRef, useState } from "react";
import { useMovimentoReduzido } from "@/hooks/useMediaQuery";

/**
 * Comportamento de uma faixa horizontal contínua — a régua de mandatos.
 *
 * Separa o que é gesto do que é desenho: a faixa rola, avisa quando há mais
 * conteúdo nas bordas e traz a seleção para a área visível. A régua fica só
 * com a geometria e os rótulos.
 */
export function useTrilhoRolavel(selecionados: string[]) {
  const trilho = useRef<HTMLDivElement>(null);
  const botoes = useRef<Record<string, HTMLButtonElement | null>>({});
  const [excede, definirExcede] = useState({ esquerda: false, direita: false });
  const movimentoReduzido = useMovimentoReduzido();
  const primeiraRolagem = useRef(true);

  const medir = useCallback(() => {
    const elemento = trilho.current;
    if (!elemento) return;
    const sobra = elemento.scrollWidth - elemento.clientWidth;
    definirExcede({
      esquerda: sobra > 1 && elemento.scrollLeft > 2,
      direita: sobra > 1 && elemento.scrollLeft < sobra - 2,
    });
  }, []);

  useEffect(() => {
    const elemento = trilho.current;
    if (!elemento) return;
    medir();
    elemento.addEventListener("scroll", medir, { passive: true });
    const observador = new ResizeObserver(medir);
    observador.observe(elemento);
    return () => {
      elemento.removeEventListener("scroll", medir);
      observador.disconnect();
    };
  }, [medir]);

  // Trazer a seleção para a área visível. Roda também na primeira pintura, sem
  // animação: no Comparar os dois mandatos padrão estão no meio da faixa e é
  // melhor já abrir enquadrando o par do que deixar o B fora da tela.
  useEffect(() => {
    const elemento = trilho.current;
    if (!elemento) return;
    const ids = selecionados.filter((id) => botoes.current[id]);
    const alvo = botoes.current[ids[ids.length - 1] ?? ""];
    if (!alvo) return;

    let esquerda = alvo.offsetLeft - (elemento.clientWidth - alvo.offsetWidth) / 2;

    // Com dois mandatos selecionados, tenta enquadrar o par inteiro. Se eles
    // estiverem próximos, ambos aparecem; se estiverem distantes, o recém-
    // escolhido é que precisa estar visível.
    const primeiro = botoes.current[ids[0]];
    if (ids.length > 1 && primeiro) {
      const inicio = primeiro.offsetLeft;
      const fim = alvo.offsetLeft + alvo.offsetWidth;
      if (fim - inicio <= elemento.clientWidth * 1.25) {
        esquerda = inicio - (elemento.clientWidth - (fim - inicio)) / 2;
      }
    }

    elemento.scrollTo({
      left: Math.max(0, esquerda),
      behavior: primeiraRolagem.current || movimentoReduzido ? "auto" : "smooth",
    });
    primeiraRolagem.current = false;
    // `selecionados` é recriado a cada render; a chave estável evita rolagem à toa.
  }, [selecionados.join("|"), movimentoReduzido]);

  const registrar = useCallback((id: string, elemento: HTMLButtonElement | null) => {
    botoes.current[id] = elemento;
  }, []);

  return { trilho, registrar, excede, medir };
}
