import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * Fronteira de erro da aplicação.
 *
 * Sem ela, uma exceção em qualquer componente desmonta a árvore inteira e o
 * usuário fica com uma página em branco — foi exatamente o que aconteceu quando
 * `localStorage` estava bloqueado no contexto do navegador.
 *
 * Aqui a falha vira uma mensagem legível: o app continua no ar, o erro aparece,
 * e a origem fica visível para quem for corrigir.
 */

interface Props {
  children: ReactNode;
}

interface Estado {
  erro: Error | null;
}

export class Fronteira extends Component<Props, Estado> {
  state: Estado = { erro: null };

  static getDerivedStateFromError(erro: Error): Estado {
    return { erro };
  }

  componentDidCatch(erro: Error, info: ErrorInfo): void {
    console.error("[republica] falha não tratada", erro, info.componentStack);
  }

  render() {
    const { erro } = this.state;
    if (!erro) return this.props.children;

    return (
      <div className="bg-background text-foreground flex min-h-dvh items-center justify-center p-6">
        <div className="border-border w-full max-w-lg rounded-sm border p-6">
          <p className="rotulo">Falha na aplicação</p>
          <h1 className="font-serif mt-2 text-lg font-semibold">
            O app não conseguiu desenhar esta tela.
          </h1>
          <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
            Os dados vêm de APIs públicas e continuam disponíveis — a falha foi na
            interface. Recarregar a página costuma resolver.
          </p>
          <pre className="border-border text-muted-foreground mt-3 max-h-40 overflow-auto rounded-sm border p-2 font-mono text-[11px] whitespace-pre-wrap">
            {erro.message}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="border-border focus-visible:ring-ring mt-4 rounded-sm border px-3 py-1.5 text-xs transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:outline-none"
          >
            Recarregar
          </button>
        </div>
      </div>
    );
  }
}
