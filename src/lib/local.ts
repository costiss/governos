/**
 * Acesso tolerante ao `localStorage`.
 *
 * `window.localStorage` LANÇA em vários contextos reais — iframe em sandbox,
 * modo privado estrito, política de terceiros do navegador. E lança no meio de
 * um inicializador de `useState`, o que derruba a árvore inteira: o app fica em
 * branco por causa de uma preferência de tema.
 *
 * Um app cujo dado é público não pode depender de armazenamento local para
 * funcionar. Aqui a falha é sempre silenciosa e o valor volta ao padrão.
 */

export function lerLocal(chave: string): string | null {
  try {
    return window.localStorage.getItem(chave);
  } catch {
    return null;
  }
}

export function gravarLocal(chave: string, valor: string): void {
  try {
    window.localStorage.setItem(chave, valor);
  } catch {
    /* bloqueado: a preferência vale para esta sessão e não persiste */
  }
}
