/**
 * Os mandatos presidenciais da Nova República, em sequência contígua desde
 * 15/03/1985. Este arquivo é a espinha dorsal do app: a régua, o recorte da
 * visão Comparar e o agrupamento da visão geral saem todos daqui.
 *
 * Datas de posse e transmissão, com as duas rupturas do período:
 *   · Collor — renúncia em 29/12/1992, no curso do impeachment.
 *   · Dilma II — afastada em 12/05/2016; o mandato encerra ali, quando Temer
 *     assume a presidência. A cassação definitiva veio em 31/08/2016, mas o
 *     cargo já era de Temer — por isso a fronteira fica em 12/05.
 */

export interface Governo {
  id: string;
  presidente: string;
  /** Como o mandato é chamado na régua: "Sarney", "FHC I", "Lula III". */
  mandato: string;
  partido: string;
  /** ISO-8601. */
  inicio: string;
  /** ISO-8601, ou `null` se em curso. */
  fim: string | null;
  /** Verdadeiro quando assumiu sem eleição direta prévia própria. */
  interino?: boolean;
  nota?: string;
}

export const GOVERNOS: Governo[] = [
  {
    id: "sarney",
    presidente: "José Sarney",
    mandato: "Sarney",
    partido: "PMDB",
    inicio: "1985-03-15",
    fim: "1990-03-15",
    interino: true,
    nota: "Assumiu interinamente em 15/03/1985 por impedimento de Tancredo Neves, e em definitivo em 21/04/1985.",
  },
  {
    id: "collor",
    presidente: "Fernando Collor de Mello",
    mandato: "Collor",
    partido: "PRN",
    inicio: "1990-03-15",
    fim: "1992-12-29",
    nota: "Renunciou em 29/12/1992, no curso do processo de impeachment.",
  },
  {
    id: "itamar",
    presidente: "Itamar Franco",
    mandato: "Itamar",
    partido: "PMDB",
    inicio: "1992-12-29",
    fim: "1995-01-01",
    interino: true,
    nota: "Completou o mandato de Collor. O Plano Real entrou em vigor em 1º/07/1994.",
  },
  {
    id: "fhc-i",
    presidente: "Fernando Henrique Cardoso",
    mandato: "FHC I",
    partido: "PSDB",
    inicio: "1995-01-01",
    fim: "1999-01-01",
  },
  {
    id: "fhc-ii",
    presidente: "Fernando Henrique Cardoso",
    mandato: "FHC II",
    partido: "PSDB",
    inicio: "1999-01-01",
    fim: "2003-01-01",
  },
  {
    id: "lula-i",
    presidente: "Luiz Inácio Lula da Silva",
    mandato: "Lula I",
    partido: "PT",
    inicio: "2003-01-01",
    fim: "2007-01-01",
  },
  {
    id: "lula-ii",
    presidente: "Luiz Inácio Lula da Silva",
    mandato: "Lula II",
    partido: "PT",
    inicio: "2007-01-01",
    fim: "2011-01-01",
  },
  {
    id: "dilma-i",
    presidente: "Dilma Rousseff",
    mandato: "Dilma I",
    partido: "PT",
    inicio: "2011-01-01",
    fim: "2015-01-01",
  },
  {
    id: "dilma-ii",
    presidente: "Dilma Rousseff",
    mandato: "Dilma II",
    partido: "PT",
    inicio: "2015-01-01",
    fim: "2016-05-12",
    nota: "Afastada em 12/05/2016 pelo Senado; cassada em 31/08/2016.",
  },
  {
    id: "temer",
    presidente: "Michel Temer",
    mandato: "Temer",
    partido: "MDB",
    inicio: "2016-05-12",
    fim: "2019-01-01",
    interino: true,
    nota: "Assumiu interinamente em 12/05/2016 e em definitivo em 31/08/2016.",
  },
  {
    id: "bolsonaro",
    presidente: "Jair Bolsonaro",
    mandato: "Bolsonaro",
    partido: "PL",
    inicio: "2019-01-01",
    fim: "2023-01-01",
  },
  {
    id: "lula-iii",
    presidente: "Luiz Inácio Lula da Silva",
    mandato: "Lula III",
    partido: "PT",
    inicio: "2023-01-01",
    fim: null,
    nota: "Mandato em curso; os últimos períodos têm dados preliminares.",
  },
];

export const INICIO_SERIE = "1985-03-15";

/** Instante de corte para todo o app: o dia de hoje. */
export function hoje(): Date {
  const agora = new Date();
  return new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate()));
}

export function fimDoGoverno(governo: Governo, referencia: Date = hoje()): Date {
  return new Date(governo.fim ?? referencia.toISOString().slice(0, 10));
}

/** Duração do mandato em meses (para a régua e para o eixo "mês de mandato"). */
export function mesesDeMandato(governo: Governo, referencia: Date = hoje()): number {
  return mesesEntre(new Date(governo.inicio), fimDoGoverno(governo, referencia));
}

export function mesesEntre(de: Date, ate: Date): number {
  return Math.max(
    0,
    (ate.getUTCFullYear() - de.getUTCFullYear()) * 12 + (ate.getUTCMonth() - de.getUTCMonth()),
  );
}

/** Todos os mandatos que se sobrepõem a um intervalo. */
export function governosNoIntervalo(de: string | Date, ate: string | Date): Governo[] {
  const inicio = new Date(de);
  const fim = new Date(ate);
  return GOVERNOS.filter((g) => new Date(g.inicio) < fim && fimDoGoverno(g) > inicio);
}

/** Qual mandato responde por uma data. */
export function governoEm(data: string | Date): Governo | undefined {
  const instante = new Date(data);
  return GOVERNOS.find((g) => {
    const inicio = new Date(g.inicio);
    return instante >= inicio && instante < fimDoGoverno(g);
  });
}

/**
 * Posição de uma data dentro do mandato, em meses, começando em 0.
 * É a coordenada x da visão Comparar: dois mandatos sobrepostos no tempo.
 */
export function mesNoMandato(data: string | Date, governo: Governo): number {
  return mesesEntre(new Date(governo.inicio), new Date(data));
}

/** Agrupa por presidente, preservando a ordem cronológica. */
export function porPresidente(): Array<{ presidente: string; mandatos: Governo[] }> {
  const grupos: Array<{ presidente: string; mandatos: Governo[] }> = [];
  for (const governo of GOVERNOS) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.presidente === governo.presidente) {
      ultimo.mandatos.push(governo);
    } else {
      grupos.push({ presidente: governo.presidente, mandatos: [governo] });
    }
  }
  return grupos;
}
