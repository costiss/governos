import { AlertTriangle, Loader2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { LegendaRampa, MapaBrasil, type DadoUf } from "@/components/geo/MapaBrasil";
import { FichaIndicador } from "@/components/hud/FichaIndicador";
import { useHashRoute } from "@/hooks/useHashRoute";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useEstados } from "@/hooks/useSerie";
import type { Ponto } from "@/lib/api/types";
import { formatarValor } from "@/lib/format";
import { INDICADORES_MAPEAVEIS, indicadorPorId } from "@/lib/indicadores";
import { UFS, nomeDaUf, normalizarSigla } from "@/lib/uf";
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
  // As caixas de chamada dos estados pequenos comem 15% da largura. No celular
  // isso encolheria o país e os rótulos abaixo do legível — lá a lista ao lado
  // assume o papel de alvo preciso.
  const telaAmpla = useMediaQuery("(min-width: 640px)");

  const escolhido = indicadorPorId(rota.params.get("i")) ?? INDICADORES_MAPEAVEIS[0];
  const anoDesejado = rota.params.get("ano");

  const { data, isPending, error } = useEstados(escolhido);

  /** Converte as chaves do provedor (código IBGE ou sigla) para sigla de UF. */
  const porUf = useMemo(() => {
    if (!data) return {} as Record<string, Ponto[]>;
    const saida: Record<string, Ponto[]> = {};
    for (const [territorio, pontos] of data.entries()) {
      const uf = normalizarSigla(territorio);
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

  /**
   * Ordem de leitura: sempre do maior valor para o menor.
   *
   * Na prática isso põe o PIOR primeiro quando o indicador é "menor é melhor"
   * (homicídio, Gini) e o MELHOR primeiro quando é "maior é melhor" (renda,
   * escolarização). O critério nunca inverte por causa da valência — só o
   * rótulo muda, para dizer a verdade sobre o que está no topo.
   */
  const ranking = useMemo(() => {
    return Object.entries(valores)
      .filter(([, item]) => item.valor != null)
      .map(([sigla, item]) => ({ sigla, valor: item.valor as number }))
      .sort((a, b) => b.valor - a.valor);
  }, [valores]);

  const rotuloRanking =
    escolhido?.direcao === "baixo-melhor"
      ? "Pior → melhor"
      : escolhido?.direcao === "alto-melhor"
        ? "Melhor → pior"
        : "Maior → menor";

  const extremos = useMemo(() => {
    if (!unidade || ranking.length === 0) return null;
    const valoresOrdenados = [...ranking].sort((a, b) => a.valor - b.valor);
    return {
      minimo: formatarValor(valoresOrdenados[0].valor, unidade).numero,
      maximo: formatarValor(valoresOrdenados[valoresOrdenados.length - 1].valor, unidade).numero,
    };
  }, [ranking, unidade]);

  /**
   * O estado tocado vira uma ficha curta. No celular o mapa é uma sinopse —
   * as áreas dos estados pequenos não são alvos confiáveis —, então o valor
   * exato precisa aparecer em texto, não só num rótulo de 5px.
   */
  const detalhe = useMemo(() => {
    if (!ufAtiva || !unidade) return null;
    const item = valores[ufAtiva];
    const posicao = ranking.findIndex((linha) => linha.sigla === ufAtiva);
    return {
      sigla: ufAtiva,
      nome: nomeDaUf(ufAtiva),
      texto: item?.valor == null ? "—" : formatarValor(item.valor, unidade).completo,
      ano: item?.ano ?? null,
      posicao: posicao >= 0 ? posicao + 1 : null,
    };
  }, [ufAtiva, valores, ranking, unidade]);

  /** Cobertura real do recorte estadual, para a ficha de procedência. */
  const cobertura = useMemo(() => {
    const pontos = Object.values(porUf).flat();
    if (pontos.length === 0) return null;
    let de = pontos[0].data;
    let ate = pontos[0].data;
    for (const ponto of pontos) {
      if (ponto.data < de) de = ponto.data;
      if (ponto.data > ate) ate = ponto.data;
    }
    return { de, ate, n: pontos.length };
  }, [porUf]);

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
            name="indicador"
            value={escolhido.id}
            onChange={(evento) => definirParam("i", evento.target.value)}
            aria-label="Indicador"
            className="border-border bg-card text-foreground focus-visible:ring-ring h-11 max-w-[15rem] rounded-sm border px-2 text-[11px] focus-visible:ring-2 focus-visible:outline-none sm:h-8"
          >
            {INDICADORES_MAPEAVEIS.map((indicador) => (
              <option key={indicador.id} value={indicador.id}>
                {indicador.curto}
              </option>
            ))}
          </select>

          {anos.length > 1 && (
            <select
              name="ano"
              value={ano}
              onChange={(evento) => definirParam("ano", evento.target.value)}
              aria-label="Ano"
              className="border-border bg-card text-foreground focus-visible:ring-ring h-11 rounded-sm border px-2 font-mono text-[11px] focus-visible:ring-2 focus-visible:outline-none sm:h-8"
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

      <div className="grid gap-5 lg:grid-cols-[minmax(0,720px)_minmax(280px,1fr)] lg:gap-6">
        <div className="border-border relative rounded-sm border p-2 sm:p-3">
          {isPending ? (
            <div className="text-muted-foreground flex h-[min(92vw,380px)] items-center justify-center gap-2 text-xs sm:h-[520px] lg:h-[560px]">
              <Loader2 className="size-3.5 animate-spin" />
              Lendo a série por UF…
            </div>
          ) : (
            <div className="h-[min(92vw,380px)] sm:h-[520px] lg:h-[560px]">
              <MapaBrasil
                dados={dadosMapa}
                ufAtiva={ufAtiva}
                aoSelecionar={definirUfAtiva}
                comChamadas={telaAmpla}
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
          <p className="text-muted-foreground mt-1.5 text-[10px] sm:hidden">
            {isPending ? "Carregando o recorte estadual…" : "Toque num estado. Os menores estão na lista abaixo."}
          </p>
        </div>

        <aside className="min-w-0">
          <div className="border-border mb-2 min-h-12 border-b pb-2">
            {detalhe ? (
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="rotulo">
                    {detalhe.sigla} · {detalhe.nome}
                  </p>
                  <p className="mt-0.5 font-mono text-sm tabular-nums" data-num>
                    {detalhe.texto}
                    {detalhe.ano != null && (
                      <span className="text-muted-foreground ml-1.5 text-[10px]">{detalhe.ano}</span>
                    )}
                  </p>
                  {detalhe.posicao != null && (
                    <p className="text-muted-foreground text-[10px]">
                      {detalhe.posicao}º de {ranking.length} unidades
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => definirUfAtiva(null)}
                  aria-label={`Limpar a seleção de ${detalhe.nome}`}
                  className="text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring flex size-11 shrink-0 items-center justify-center rounded-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ) : (
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                Selecione um estado do mapa — ou uma linha da lista — para ver o valor.
              </p>
            )}
          </div>

          <p className="rotulo border-border mb-2 border-b pb-1.5">{rotuloRanking}</p>
          <ol className="quiet-scroll sm:max-h-[520px] sm:overflow-y-auto lg:max-h-[560px]">
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
                      "focus-visible:ring-ring flex min-h-11 w-full items-center gap-2 py-2.5 text-left text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none sm:min-h-0 sm:py-1",
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
                    <span className="w-16 shrink-0 text-right font-mono text-[11px] tabular-nums" data-num>
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
        <FichaIndicador indicador={escolhido} recorte="Unidades da federação" cobertura={cobertura} />
      </div>
    </div>
  );
}
