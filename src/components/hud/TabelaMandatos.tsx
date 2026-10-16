import { GOVERNOS, fimDoGoverno, hoje, mesesDeMandato } from "@/lib/governos";
import type { Governo } from "@/lib/governos";
import type { Unidade } from "@/lib/api/types";
import type { Ponto } from "@/lib/api/types";
import { recortar, resumir } from "@/lib/serie";
import { formatarAno, formatarDuracao, formatarValor } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * A tabela do anuário: um mandato por linha, as estatísticas do período em
 * colunas. É onde o app deixa de ser gráfico e volta a ser documento — e é
 * frequentemente a leitura mais útil.
 *
 * A variação se marca por SÍMBOLO (▲/▼) e não por cor: num app preto e branco,
 * cor não pode ser o único portador de significado.
 */

interface TabelaMandatosProps {
  pontos: Ponto[];
  unidade: Unidade;
  selecionados?: string[];
  aoAlternar?: (id: string) => void;
  /** Marca o mandato em que o dado começa a existir como indisponível. */
  className?: string;
}

interface LinhaMandato {
  governo: Governo;
  pontos: Ponto[];
  n: number;
  primeiro: number | null;
  ultimo: number | null;
  variacao: number | null;
  media: number | null;
  minimo: number | null;
  maximo: number | null;
  meses: number;
}

function montarLinhas(pontos: Ponto[]): LinhaMandato[] {
  const referencia = hoje();
  return GOVERNOS.map((governo) => {
    const doMandato = recortar(pontos, governo.inicio, fimDoGoverno(governo, referencia).toISOString().slice(0, 10));
    const resumo = resumir(doMandato);
    return {
      governo,
      pontos: doMandato,
      meses: mesesDeMandato(governo, referencia),
      ...resumo,
    };
  });
}

export function TabelaMandatos({
  pontos,
  unidade,
  selecionados = [],
  aoAlternar,
  className,
}: TabelaMandatosProps) {
  const linhas = montarLinhas(pontos);
  const maiorMedia = Math.max(...linhas.map((l) => Math.abs(l.media ?? 0)), 0);

  return (
    <div className={cn("quiet-scroll -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0", className)}>
      <table className="w-full min-w-[560px] border-collapse text-xs">
        <caption className="sr-only">
          Estatísticas do indicador por mandato presidencial
        </caption>
        <thead>
          <tr className="border-border border-b">
            <Th className="text-left">Mandato</Th>
            <Th className="text-left">Período</Th>
            <Th>Início</Th>
            <Th>Fim</Th>
            <Th>Variação</Th>
            <Th>Média</Th>
            <Th className="hidden sm:table-cell">Mín — máx</Th>
            <Th className="hidden md:table-cell text-left">Duração</Th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha) => {
            const vazio = linha.n === 0;
            const ativo = selecionados.includes(linha.governo.id);
            const interativo = Boolean(aoAlternar) && !vazio;

            return (
              <tr
                key={linha.governo.id}
                onClick={interativo ? () => aoAlternar?.(linha.governo.id) : undefined}
                aria-selected={interativo ? ativo : undefined}
                className={cn(
                  "border-border/60 border-b transition-colors duration-150",
                  interativo && "cursor-pointer hover:bg-accent",
                  ativo && "bg-accent",
                  vazio && "text-muted-foreground/50",
                )}
              >
                <td className="py-1.5 pr-3">
                  <span className="flex items-center gap-1.5">
                    <span
                      aria-hidden="true"
                      className={cn("h-3 w-[2px] shrink-0", ativo ? "bg-foreground" : "bg-transparent")}
                    />
                    <span className="text-foreground/95 font-medium whitespace-nowrap">
                      {linha.governo.mandato}
                    </span>
                  </span>
                  <span className="text-muted-foreground block text-[10px]">
                    {linha.governo.partido}
                  </span>
                </td>

                <td className="text-muted-foreground py-1.5 pr-3 font-mono text-[10px] whitespace-nowrap tabular-nums" data-num>
                  {formatarAno(linha.governo.inicio)}–{linha.governo.fim ? formatarAno(linha.governo.fim) : "hoje"}
                </td>

                <Numero valor={linha.primeiro} unidade={unidade} />
                <Numero valor={linha.ultimo} unidade={unidade} />

                <td className="py-1.5 px-2 text-right">
                  <Variacao valor={linha.variacao} />
                </td>

                <td className="py-1.5 px-2 text-right">
                  <span className="inline-flex items-center justify-end gap-2">
                    <Barra fracao={maiorMedia > 0 ? Math.abs(linha.media ?? 0) / maiorMedia : 0} />
                    <span className="font-mono text-[11px] tabular-nums" data-num>
                      {formatarValor(linha.media, unidade).numero}
                    </span>
                  </span>
                </td>

                <td className="hidden py-1.5 px-2 text-right font-mono text-[10px] tabular-nums sm:table-cell" data-num>
                  {vazio ? (
                    <span className="text-muted-foreground/50">—</span>
                  ) : (
                    <>
                      {formatarValor(linha.minimo, unidade).numero}
                      <span className="text-muted-foreground/60"> — </span>
                      {formatarValor(linha.maximo, unidade).numero}
                    </>
                  )}
                </td>

                <td className="text-muted-foreground hidden py-1.5 pl-3 text-[10px] whitespace-nowrap md:table-cell">
                  {formatarDuracao(linha.meses)}
                  {linha.governo.fim === null && <span className="ml-1">(em curso)</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={cn(
        "rotulo py-1.5 px-2 font-semibold first:pl-0 last:pr-0",
        className ?? "text-right",
      )}
    >
      {children}
    </th>
  );
}

function Numero({ valor, unidade }: { valor: number | null; unidade: Unidade }) {
  return (
    <td className="py-1.5 px-2 text-right font-mono text-[11px] tabular-nums" data-num>
      {valor == null ? <span className="text-muted-foreground/50">—</span> : formatarValor(valor, unidade).numero}
    </td>
  );
}

function Variacao({ valor }: { valor: number | null }) {
  if (valor == null || !Number.isFinite(valor)) {
    return <span className="text-muted-foreground/50 font-mono text-[11px]">—</span>;
  }
  const subiu = valor > 0;
  const neutro = Math.abs(valor) < 0.05;
  return (
    <span className="inline-flex items-center justify-end gap-1 font-mono text-[11px] tabular-nums" data-num>
      {!neutro && (
        <span aria-hidden="true" className="text-[9px] leading-none">
          {subiu ? "▲" : "▼"}
        </span>
      )}
      {valor.toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%
    </span>
  );
}

/** Barra fina de magnitude — dá escala à média sem competir com o gráfico. */
function Barra({ fracao }: { fracao: number }) {
  return (
    <span aria-hidden="true" className="bg-border hidden h-1.5 w-12 overflow-hidden rounded-[1px] sm:block">
      <span
        className="bg-foreground/70 block h-full"
        style={{ width: `${Math.max(2, Math.min(100, fracao * 100))}%` }}
      />
    </span>
  );
}
