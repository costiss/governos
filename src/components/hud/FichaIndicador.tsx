import { ArrowUpRight } from "lucide-react";
import { FONTES } from "@/lib/api/types";
import type { Indicador } from "@/lib/indicadores/tipos";
import type { Serie } from "@/lib/api/types";
import { formatarMesLongo } from "@/lib/format";

/**
 * Cabeçalho de série: o que é, de onde veio, até quando vai.
 *
 * A procedência fica sempre visível e sempre clicável — um número de governo
 * sem a fonte ao lado é uma afirmação sem prova.
 */

interface FichaIndicadorProps {
  indicador: Indicador;
  serie?: Serie;
  /** Texto do recorte em vigor (ex.: "Brasil" ou "São Paulo"). */
  recorte?: string;
}

export function FichaIndicador({ indicador, serie, recorte }: FichaIndicadorProps) {
  const fonte = FONTES[indicador.fonte];
  const primeiro = serie?.pontos[0];
  const ultimo = serie?.pontos[serie.pontos.length - 1];

  return (
    <div className="text-muted-foreground grid gap-x-6 gap-y-2 text-[11px] sm:grid-cols-2">
      <Campo rotulo="Fonte">
        <a
          href={indicador.consulta}
          target="_blank"
          rel="noreferrer"
          className="text-foreground hover:underline inline-flex items-center gap-0.5"
        >
          {fonte.sigla}
          <ArrowUpRight className="size-3" />
        </a>
        <span className="mx-1 text-border-strong">·</span>
        <span className="font-mono text-[10px]">{indicador.codigo}</span>
      </Campo>

      <Campo rotulo="Recorte">
        {recorte ?? "Brasil"}
        {indicador.porUf && <span className="ml-1 font-mono text-[10px]">(por UF)</span>}
      </Campo>

      <Campo rotulo="Unidade">{indicador.unidade.nome}</Campo>

      <Campo rotulo="Cobertura">
        {primeiro && ultimo ? (
          <span className="font-mono tabular-nums" data-num>
            {formatarMesLongo(primeiro.data)} — {formatarMesLongo(ultimo.data)}
            <span className="text-muted-foreground ml-1">({serie?.pontos.length} pontos)</span>
          </span>
        ) : (
          "—"
        )}
      </Campo>

      <Campo rotulo="Definição" className="sm:col-span-2">
        {indicador.descricao}
      </Campo>

      {serie?.url && (
        <Campo rotulo="Consulta direta" className="sm:col-span-2">
          <a
            href={serie.url}
            target="_blank"
            rel="noreferrer"
            className="hover:text-foreground font-mono text-[10px] break-all"
          >
            {serie.url}
          </a>
        </Campo>
      )}
    </div>
  );
}

function Campo({
  rotulo,
  children,
  className,
}: {
  rotulo: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="rotulo mb-0.5">{rotulo}</p>
      <p className="text-foreground/90 leading-relaxed">{children}</p>
    </div>
  );
}
