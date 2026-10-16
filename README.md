# República

Comparador de indicadores oficiais do Brasil desde a re-democratização — 15 de março de
1985 aos dias de hoje. Todos os dados vêm de APIs públicas do Estado brasileiro.

Três visões:

| Visão | Pergunta que responde |
| --- | --- |
| **Visão geral** | Como este indicador se comportou ao longo dos 40 anos, e sob quais governos? |
| **Comparar** | Dois mandatos, lado a lado, sobrepostos pelo tempo de mandato. |
| **Mapa** | Onde, hoje, a situação está melhor ou pior entre as 27 unidades da federação. |

## Por que o app existe

Balanços de governo costumam ser séries recortadas para provar um ponto. Aqui as séries
são **integrais**, a **procedência fica sempre visível** (órgão, código e URL exata de
consulta), a comparação é **normalizada de forma explícita** — e nada é colorido para
sugerir juízo. Um app preto e branco não pode usar matiz como atalho retórico.

## Fontes de dados

Só fontes oficiais. Nada de agregadores, nada de terceiros.

| Fonte | Base | O que fornece |
| --- | --- | --- |
| **IBGE** — SIDRA | `apisidra.ibge.gov.br` | Preços, população, PIB, recortes territoriais |
| **Ipea** — Ipea Data | `ipeadata.gov.br/api/odata4` | Séries longas: trabalho, desigualdade, saúde, educação, violência |
| **Banco Central** — SGS | `api.bcb.gov.br` | Juros, câmbio, dívida pública, reservas |
| **INPE** — TerraBrasilis | `terrabrasilis.dpi.inpe.br` | Desmatamento |

A malha das UFs vem da API de malhas do IBGE, pré-projetada em
`src/lib/geo/brazilShapes.ts` (geometria adaptada de
[costiss/camara](https://github.com/costiss/camara), que usa a mesma fonte).

## Cortesia com as APIs públicas

Isso não é detalhe: são serviços estatais sem SLA para uso abusivo. Três camadas:

**1. Limitador por host** (`src/lib/api/http.ts`) — teto de concorrência por host,
espaçamento mínimo entre chamadas consecutivas, e respeito a `Retry-After` em 429/503
(que pausa o host inteiro, não só a requisição).

**2. Cache do TanStack Query** (`src/lib/queryClient.ts`) — `staleTime` de 30 dias para
dados consolidados e 6 horas para o período corrente. **Não há refetch por foco de
janela nem por reconexão**: histórico de governo não muda.

**3. Persistência em IndexedDB** (`src/lib/idb.ts`) — o cache sobrevive ao fechamento da
aba. Cada série é buscada *uma vez por navegador*, não uma vez por visita.

O resultado: abrir o app em um computador novo custa algumas dezenas de requisições, e
nenhuma nas aberturas seguintes.

## Arquitetura

```
src/
├── lib/
│   ├── api/            adapters: sidra.ts, ipea.ts, bcb.ts + http.ts (limitador)
│   │   └── types.ts    Serie, Ponto, Unidade, Fonte, Categoria
│   ├── indicadores/    o catálogo. Um arquivo por categoria.
│   │   ├── tipos.ts    a interface Indicador — o contrato
│   │   ├── apoio.ts    denominadores (população, PIB)
│   │   └── index.ts    registro por import.meta.glob
│   ├── governos.ts     os 12 mandatos, 1985 → hoje
│   ├── serie.ts        recorte, reamostragem, normalização, alinhamento por mandato
│   ├── geo/            malhas das UFs
│   └── format.ts       pt-BR, numerais tabulares
├── components/
│   ├── hud/            Regua, SeletorIndicador, TabelaMandatos, FichaIndicador
│   ├── charts/         GraficoArea (wrapper do evilcharts)
│   ├── geo/            MapaBrasil
│   ├── evilcharts/     registro shadcn @evilcharts
│   └── ui/             primitivos shadcn
└── views/              OverviewView, CompareView, MapaView
```

### Por que a régua importa

A `Regua` é a peça central. Cada mandato ocupa largura **proporcional à sua duração**
real (`flex-grow = meses`), então a faixa nunca mente sobre quando as coisas
aconteceram. O mesmo componente é o eixo do tempo na Visão geral e o seletor de dois
mandatos na visão Comparar — quem olha um gráfico nunca perde a referência histórica.

### Como as séries se distinguem sem cor

Séries se separam por três coisas ao mesmo tempo, nunca por matiz:

1. **valor de tinta** — da tinta cheia ao cinza chumbo (`--ink-1` … `--ink-9`);
2. **textura do traço** — sólido, tracejado, pontilhado (`strokeVariant`);
3. **textura do preenchimento** — gradiente, hachurado, linhas, nenhum (`variant`).

Isso reaproveita o vocabulário do [evilcharts](https://evilcharts.com) em vez de
contorná-lo, e dá até quatro séries legíveis em preto e branco.

### O eixo "mês de mandato"

Na visão Comparar o eixo x deixa de ser o calendário e passa a ser o **tempo decorrido
desde a posse**. Um mandato de 3 anos e 8 meses (Temer) e um de 4 anos ficam comparáveis
ponto a ponto. É `alinharPorMandato()` em `src/lib/serie.ts`.

## Adicionar um indicador

Crie o arquivo da categoria em `src/lib/indicadores/` exportando um array de `Indicador`:

```ts
import type { Indicador } from "@/lib/indicadores/tipos";
import { buscarBcb } from "@/lib/api/bcb";

export const INDICADORES_ECONOMIA: Indicador[] = [
  {
    id: "selic-meta",
    nome: "Taxa Selic — meta definida pelo Copom",
    curto: "Selic (meta)",
    categoria: "economia",
    descricao: "…",
    unidade: { simbolo: "% a.a.", nome: "por cento ao ano", casas: 2, sufixo: "% a.a." },
    frequencia: "diaria",
    desde: 1999,
    direcao: null,          // sem juízo de valor: juro não é bom nem ruim
    fonte: "bcb",
    codigo: "BCB SGS 432",
    consulta: "https://…",
    normalizacoes: ["absoluto"],
    async buscar({ signal }) {
      const pontos = await buscarBcb({ codigo: 432, rotulo: "Selic meta", signal });
      return montarSerie(/* … */);
    },
  },
];
```

O registro descobre o arquivo sozinho — **não há lista para editar**. O indicador aparece
na Visão geral e no seletor da visão Comparar imediatamente.

## Rodar

```bash
pnpm install
pnpm dev        # http://localhost:5173
pnpm build      # type-check + bundle
```

Nenhuma chave de API. Nenhum backend. O navegador fala direto com os órgãos públicos.
