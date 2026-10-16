import { AlertTriangle, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { LegendaRampa, MapaBrasil, type DadoUf } from "@/components/geo/MapaBrasil";
import { FichaIndicador } from "@/components/hud/FichaIndicador";
import { useHashRoute } from "@/hooks/useHashRoute";
import { useEstados } from "@/hooks/useSerie";
import type { Ponto } from "@/lib/api/types";
import { formatarValor } from "@/lib/format";
import { INDICADORES_MAPEAVEIS, indicadorPorId } from "@/lib/indicadores";
import { UF_POR_CODIGO } from "@/lib/api/sidra";
import { UFS, nomeDaUf } from "@/lib/uf";
import { cn } from "@/lib/utils";

/**
 * O Brasil por UF.
 *
 * A pergunta que esta tela responde é diferente das outras duas: não "como
 * mudou no tempo", mas "onde a coisa está pior agora". Por isso ela carrega
 * só os indicadores cuja fonte entrega o recorte estadual numa chamada única.
 */

export function MapaView() {
  const { rota, definirParam } = useHashRoute();
  const [ufAtiva, definirUfAtiva] = useState<string | null>(null);

  const escolhido = indicadorPorId(rota.params.get("i")) ?? INDICADORES_MAPEAVEIS[0];
  const anoDesejado = rota.params.get("ano");

  const { data, isPending, error } = useEstados(escolhido, escolhido?.serieEstadual);

  /** Converte o mapa código-do-território → série, para os códigos do IBGE. */
  const porUf = useMemo(() => {
    if (!data) return {} as Record<string, Ponto[]>;
    const saida: Record<string, Ponto[]> = {};
    for (const [territorio, pontos] of data.entries()) {
      const uf = UF_POR_CODIGO[territorio] ?? UF_POR_CODIGO[territorio.slice(0, 2)];
      if (uf) saida[uf] = pontos;
    }
    return saida;
  }, [data]);

  /** Anos disponíveis na série estadual, do mais recente ao mais antigo. */
  const anos = useMemo(() => {
    const conjunto = new Set<number>();
    for (const pontos of Object.values(porUf)) {
      for (const ponto of pontos) conjunto.add(Number(ponto.data.slice(0, 4)));
    }
    return [...conjunto].sort((a, b) => b - a);
  }, [porUf]);

  const ano = anoDesejado ?? (anos[0] != null ? String(anos[0]) : "");

  /** Valor de cada UF no ano escolhido — o último ponto daquele ano. */
  const valores = useMemo(() => {
    const saida: Record<string, { valor: number | null; ano: number | null }> = {};
    for (const uf of UFS) {
      const pontos = porUf[uf.sigla] ?? [];
      const doAno = pontos.filter((ponto) => ponto.data.slice(0, 4) === ano);
      const ultimo = doAno[doAno.length - 1];
      saida[uf.sigla] = { valor: ultimo?.valor ?? null, ano: ultimo ? Number(ultimo.data.slice(0, 4)) : null };
    }
    return saida;
  }, [porUf, ano]);

  const unidade = escolhido?.unidade;
  const dadosMapa = useMemo<Record<string, DadoUf>>(() => {
    if (!unidade) return {};
    return Object.fromEntries(
      Object.entries(valores).map(([sigla, { valor, ano }]) => [
        sigla,
        {
          valor,
          texto: valor == null ? "—" : formatarValor(valor, unidade).numero,
          descricao:
            valor == null
              ? `${nomeDaUf(sigla)}: sem dado em ${ano}`
              : `${nomeDaUf(sigla)}: ${formatarValor(valor, unidade).completo} (${ano})`,
        },
      ]),
    );
  }, [valores, unidade]);

  const ranking = useMemo(() => {
    return Object.entries(valores)
      .filter(([, item]) => item.valor != null)
      .map(([sigla, item]) => ({ sigla, valor: item.valor as number }))
      .sort((a, b) => {
        // Ranking pela direção do indicador: o que importa primeiro no topo.
        const ruim = escolhido?.direcao === "baixo-melhor" ? -1 : 1;
        return (b.valor - a.valor) * ruim;
      });
  }, [valores, escolhido]);

  const extremos = useMemo(() => {
    if (!unidade || ranking.length === 0) return null;
    return {
      minimo: formatarValor(ranking[ranking.length - 1].valor, unidade).numero,
      maximo: formatarValor(ranking[0].valor, unidade).numero,
    };
  }, [ranking, unidade]);

  if (!escolhido) {
    return (
      <div className="border-border text-muted-foreground rounded-sm border border-dashed px-4 py-10 text-center text-sm">
        <p>Nenhum indicador com recorte estadual disponível.</p>
        <p className="mt-1 text-xs">
          O mapa depende de séries que o órgão publica por UF numa chamada única.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="rotulo">Brasil por unidade da federação</p>
          <h1 className="font-serif mt-1 text-xl leading-tight font-semibold tracking-[-0.01em] sm:text-2xl">
            {escolhido.nome}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={escolhido.id}
            onChange={(evento) => definirParam("i", evento.target.value)}
            aria-label="Indicador"
            className="border-border bg-card text-foreground focus-visible:ring-ring h-8 max-w-[15rem] rounded-sm border px-2 text-[11px] focus-visible:ring-2 focus-visible:outline-none"
          >
            {INDICADORES_MAPEAVEIS.map((indicador) => (
              <option key={indicador.id} value={indicador.id}>
                {indicador.curto}
              </option>
            ))}
          </select>

          {anos.length > 1 && (
            <select
              value={ano}
              onChange={(evento) => definirParam("ano", evento.target.value)}
              aria-label="Ano"
              className="border-border bg-card text-foreground focus-visible:ring-ring h-8 rounded-sm border px-2 font-mono text-[11px] focus-visible:ring-2 focus-visible:outline-none"
            >
              {anos.map((valor) => (
                <option key={valor} value={valor}>
                  {valor}
                </option>
              ))}
            </select>
          )}
        </div>
      </header>

      {error && (
        <div className="border-border text-muted-foreground flex items-start gap-2 rounded-sm border border-dashed px-3 py-2 text-xs">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span>Não foi possível ler a série estadual. {(error as Error).message}</span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="border-border relative rounded-sm border p-3">
          {isPending ? (
            <div className="text-muted-foreground flex h-[420px] items-center justify-center gap-2 text-xs">
              <Loader2 className="size-3.5 animate-spin" />
              Lendo a série por UF…
            </div>
          ) : (
            <div className="h-[420px] sm:h-[520px]">
              <MapaBrasil
                dados={dadosMapa}
                ufAtiva={ufAtiva}
                aoSelecionar={definirUfAtiva}
                rotulo={`${escolhido.nome} por unidade da federação em ${ano}`}
              />
            </div>
          )}

          {extremos && (
            <div className="border-border mt-2 flex flex-wrap items-center justify-between gap-2 border-t pt-2">
              <LegendaRampa minimo={extremos.minimo} maximo={extremos.maximo} rotulo={`${ano}`} />
              <p className="text-muted-foreground font-mono text-[10px]">
                {escolhido.unidade.simbolo || escolhido.unidade.nome}
              </p>
            </div>
          )}
        </div>

        <aside className="min-w-0">
          <p className="rotulo border-border mb-2 border-b pb-1.5">
            {escolhido.direcao === "baixo-melhor" ? "Pior → melhor" : "Maior → menor"}
          </p>
          <ol className="quiet-scroll max-h-[420px] overflow-y-auto sm:max-h-[520px]">
            {ranking.map((item, indice) => {
              const ativo = ufAtiva === item.sigla;
              const maior = ranking[0].valor;
              const fracao = maior !== 0 ? Math.abs(item.valor / maior) : 0;
              return (
                <li key={item.sigla}>
                  <button
                    type="button"
                    onClick={() => definirUfAtiva(ativo ? null : item.sigla)}
                    aria-pressed={ativo}
                    className={cn(
                      "focus-visible:ring-ring flex w-full items-center gap-2 py-1 text-left text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none",
                      ativo ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <span className="text-muted-foreground w-5 shrink-0 font-mono text-[10px] tabular-nums" data-num>
                      {indice + 1}
                    </span>
                    <span className={cn("w-6 shrink-0 font-medium", ativo && "text-foreground")}>
                      {item.sigla}
                    </span>
                    <span className="bg-border h-1.5 min-w-0 flex-1 overflow-hidden rounded-[1px]">
                      <span
                        className={cn("block h-full", ativo ? "bg-foreground" : "bg-foreground/45")}
                        style={{ width: `${Math.max(1, Math.min(100, fracao * 100))}%` }}
                      />
                    </span>
                    <span className="w-14 shrink-0 text-right font-mono text-[11px] tabular-nums" data-num>
                      {formatarValor(item.valor, escolhido.unidade).numero}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          {ranking.length === 0 && !isPending && (
            <p className="text-muted-foreground text-xs">Sem dados para este ano.</p>
          )}
        </aside>
      </div>

      <div className="border-border border-t pt-4">
        <FichaIndicador indicador={escolhido} recorte="Unidades da federação" />
      </div>
    </div>
  );
}
