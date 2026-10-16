import { AlertTriangle, Loader2 } from "lucide-react";

/**
 * Estados de uma leitura de série.
 *
 * Vivem num módulo próprio porque as três visões precisam dos mesmos três
 * estados, e uma view não deve importar da outra. São a mesma moldura de régua
 * tracejada em todas — a ausência de dado tem a mesma aparência em todo o app.
 */

/** Enquanto a série (ou o próprio gráfico) não chegou. */
export function CarregandoGrafico({ texto = "Lendo a série oficial…" }: { texto?: string }) {
  return (
    <div className="border-border text-muted-foreground flex h-full items-center justify-center gap-2 rounded-sm border border-dashed text-xs">
      <Loader2 className="size-3.5 animate-spin" />
      {texto}
    </div>
  );
}

/** Falha de rede ou de fonte — a mensagem original fica visível. */
export function FalhaSerie({ mensagem, oQue = "esta série" }: { mensagem: string; oQue?: string }) {
  return (
    <div className="border-border text-muted-foreground flex items-start gap-2 rounded-sm border border-dashed px-3 py-2 text-xs">
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
      <span>
        Não foi possível ler {oQue} agora. {mensagem}
      </span>
    </div>
  );
}

/** Nada a mostrar — sem indicador no catálogo ou sem dado para o recorte. */
export function EstadoVazio({
  titulo,
  detalhe,
}: {
  titulo: string;
  detalhe?: string;
}) {
  return (
    <div className="border-border text-muted-foreground rounded-sm border border-dashed px-4 py-10 text-center text-sm">
      <p>{titulo}</p>
      {detalhe && <p className="mt-1 text-xs">{detalhe}</p>}
    </div>
  );
}
