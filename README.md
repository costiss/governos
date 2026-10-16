# República

Comparador de indicadores oficiais do Brasil desde a re-democratização — 15 de março de
1985 aos dias de hoje. Todos os dados vêm de APIs públicas do Estado brasileiro.

Três visões:

| Visão | Pergunta que responde |
| --- | --- |
| **Visão geral** | Como este indicador se comportou ao longo dos 40 anos, e sob quais governos? |
| **Comparar** | Dois mandatos, lado a lado, sobrepostos pelo tempo de mandato. |
| **Mapa** | Onde, hoje, a situação está melhor ou pior entre as 27 unidades da federação. |

### Limitar o recorte

Cada visão tem o seu controle de janela, e cada um respeita o eixo que a tela usa:

- **Visão geral — Período.** "De" e "até" sobre a cobertura real da série, com a
  granularidade do dado: série anual pede ano, série mensal pede mês e ano. Oferecer um
  calendário de dias para uma série anual seria mais preciso que a informação. Atalhos:
  Tudo, Plano Real, últimos 20 e 10 anos. O recorte é aplicado **antes** da normalização,
  então `base100` ancora no início da janela escolhida.
- **Comparar — Janela.** Aqui o eixo não é o calendário, é o tempo de mandato; limitar
  significa comparar só os primeiros 12, 24 ou 36 meses de cada governo.
- **Mapa — Ano.** A série anual já tem seletor de ano.

Recorte de período e seleção de mandato são **mutuamente exclusivos**: compor os dois
produziria um gráfico vazio sempre que o mandato caísse fora da janela — e vazio sem
explicação é pior que controle nenhum.

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

**4. Snapshot de build para as séries gigantes** (`scripts/series-grandes.mjs`) — algumas
séries do Ipea misturam Brasil, as 27 UFs e os 5.570 municípios numa resposta só, e o
serviço **ignora `$top`, `$skip` e `$filter`**: a taxa de homicídios devolve ~70 MB de
qualquer jeito. Baixar isso pelo navegador seria ~70 MB por visitante — exatamente o
abuso que o app existe para evitar. Então essas séries são colhidas **uma vez, no
build**, filtradas para Brasil + UFs e embarcadas como JSON de ~47 KB:

```bash
pnpm series:sincronizar
```

O snapshot grava a data da coleta e a URL de origem, e o app mostra as duas na ficha de
procedência — snapshot sem carimbo de data é dado sem procedência.

Os arquivos são **carregados sob demanda**: cada um vira um chunk próprio, buscado só
quando o indicador que depende dele é aberto. Os 248 KB de dados não entram no bundle
inicial de quem só quer ver o IPCA.

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
│   │   ├── dados/      snapshots de build das séries gigantes
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

## Séries e quebras metodológicas

Nenhuma série oficial cobre 1985 a hoje sozinha. A taxa de desocupação, por exemplo,
existe em duas: PNAD antiga (1992–2014) e PNAD Contínua (2012–hoje) — metodologias
diferentes, patamares diferentes.

O app **não emenda as duas num gráfico só**. Emendar fontes distintas produz um salto
metodológico disfarçado de fato, que é precisamente o que um comparador de governos não
pode fazer. Em vez disso:

- as séries ficam separadas, cada uma com sua fonte e seu recorte declarados;
- o campo `alternativas` liga os indicadores que medem o **mesmo conceito em outro
  período**;
- quando a comparação escolhida não tem dado, a tela explica **por quê** ("o dado começa
  em 2012") e oferece tanto os mandatos que têm dado quanto as séries irmãs.

Assim o buraco é visível em vez de preenchido — e o caminho para o dado que existe fica a
um toque.

## Rodar

```bash
pnpm install
pnpm series:sincronizar   # opcional: só se os snapshots estiverem vencidos (180 dias)
pnpm dev                  # http://localhost:5173
pnpm build                # type-check + bundle
```

Nenhuma chave de API. Nenhum backend. O navegador fala direto com os órgãos
públicos — exceto pelas três séries que ele *não consegue* buscar, e que vêm
embarcadas (§ Cortesia com as APIs públicas).

O bundle inicial é ~157 KB gzip. O ECharts (~237 KB gzip) entra sob demanda, só
quando o gráfico aparece — o que pesa de verdade num celular.

## Catálogo

54 indicadores em 7 categorias, de 1953 a 2026 conforme a série. Cada um traz
fonte, código de origem e URL conferível; a série inteira é plotada, sem recorte
editorial, e a régua de mandatos mostra em que governo cada trecho caiu.

10 deles têm recorte por unidade da federação e alimentam o **Mapa**.

