# República — sistema de design

> Direção: **"Anuário Estatístico"**. Um anuário impresso renderizado como software.
> Papel e tinta. Nada de cor. Hierarquia por peso, régua e textura — nunca por matiz.

## Por que esta direção

**Domínio** — arquivo público, mandato e posse, Plano Real e hiperinflação, série
histórica, deflator, códigos SIDRA/OData/SGS, malha do IBGE, balanço de governo.

**Mundo de cor** — papel almaço, tinta preta, papel milimetrado, Diário Oficial,
microfilme, terminal monoespaçado.

**Assinatura** — *a régua de mandatos*: faixa contínua de 1985 ao presente, largura
proporcional à duração real de cada mandato, servindo ao mesmo tempo de eixo do tempo
(Visão geral) e de seletor A/B (Comparar). O gráfico nunca perde a referência histórica.

**Defaults rejeitados:**
1. Grid de KPI cards idênticos → **folha de série contínua**, indicadores como linhas finas
2. 8 séries coloridas → **monocromático com textura** (sólido/tracejado/hachurado/pontilhado)
3. Cartões arredondados com sombra → **hairlines e numerais tabulares**, raio 3px, planura

O teste de troca: tire o nome do produto da tela e a barra de mandatos de 40 anos ainda
identifica o app. Nenhum dashboard genérico tem essa régua.

---

## Tokens

Dois temas, ambos monocromáticos. **Tinta** é o padrão; **Papel** é a página impressa.
Definidos em `src/index.css` como custom properties; o `@theme inline` do Tailwind v4
expõe tudo como utilitários.

| Token | Tinta (padrão, `.dark`) | Papel (`.light`) |
| --- | --- | --- |
| `--background` | `#0a0a0a` | `#fafafa` |
| `--foreground` | `#fafafa` | `#0a0a0a` |
| `--card` | `#0e0e0e` | `#ffffff` |
| `--muted-foreground` | `#8f8f8f` | `#6b6b6b` |
| `--border` | `rgba(250,250,250,.09)` | `rgba(10,10,10,.11)` |
| `--border-strong` | `.../.18` | `.../.22` |
| `--border-faint` | `.../.05` | `.../.06` |

**Rampa de tinta `--ink-0` … `--ink-9`** — a escala do mapa coroplético e das séries.
Invertida entre temas de propósito: no tema tinta, valor alto clareia; no papel, escurece.
Em ambos, **mais tinta = mais valor**.

**Sem cor semântica.** O `--destructive` é o próprio primeiro plano: num app preto e
branco, cor não pode ser o único portador de significado — a variação se marca por
símbolo (▲/▼), a ausência por "—", a validação por régua.

## Tipografia

**IBM Plex Sans · Mono · Serif.** Família desenhada para contexto técnico/institucional —
não é o system-ui de sempre, e carrega o tom de órgão oficial. Serif só no wordmark e nos
títulos de série; mono para todo número.

- Base 14px, `line-height 1.45`
- Escala ~1.25: `10 · 11 · 12 · 14 · 17 · 20/24`
- **Todo numeral é tabular** (`.tnum`, `[data-num]`, `table`) — sem exceção, para o layout
  não pular quando o valor atualiza
- Versalete (`.rotulo`): 10px · 600 · tracking `.14em` · uppercase · muted — é o rótulo de
  seção em todo o app

## Profundidade e forma

- **Só régua. Nenhuma sombra.** A separação vem de `border` de 1px em opacidade baixa.
- Raio: **2px** (inputs/botões), **3px** (cards/painéis), **4px** (popovers). Nada arredondado.
- Espaçamento na grade de 4px. Densidade **compacta** — linha de tabela em `py-1.5`/`py-2`,
  corpo em 12–14px. Isto é ferramenta, não brochura.
- Alvos de toque: 44px no mobile, 32–36px no desktop.

## Cor do foco e dos estados

`:focus-visible` → `outline: 2px solid var(--ring)` com offset 2px. Séries e itens ativos se
marcam por **barra de tinta à esquerda** (`w-[2px] bg-foreground`) e por **inversão**
(`bg-foreground text-background`) — o segmentado é a expressão canônica disso.

---

## Como as séries se distinguem sem cor

Três eixos simultâneos, em `components/charts/GraficoArea.tsx`:

1. **valor de tinta** — rampa `["#fafafa","#8f8f8f","#4d4d4d","#c7c7c7","#2e2e2e"]` (tinta) e o
   inverso no papel;
2. **textura do traço** — `solid` → `dashed` → `animated-dashed` (`strokeVariant` do evilcharts);
3. **textura do preenchimento** — `gradient` → `hatched` → `lines` → `dotted` (`variant`).

Dá até quatro séries legíveis em preto e branco. A legenda usa `variant="horizontal-bar"`
para o marcador ter a forma de um traço, casando com o que está no gráfico.

## Padrões de componente

| Componente | Medidas e decisão |
| --- | --- |
| **Régua** (`hud/Regua.tsx`) | `flex-grow = meses do mandato`. 44px de altura (touch) ou 132px com colunas de valor. Ativo = invertido. Mandato em curso leva barra de 3px à direita — a régua nunca finge ter terminado |
| **Segmentado** (`hud/Segmentado.tsx`) | caixa de régua 1px, item ativo invertido; `larguraTotal` divide em partes iguais (usado no header mobile) |
| **TabelaMandatos** (`hud/TabelaMandatos.tsx`) | linha `py-1.5`, número em mono 11px à direita; variação por ▲/▼; "—" para período sem dado |
| **FichaIndicador** (`hud/FichaIndicador.tsx`) | grade 2 colunas; fonte, código, cobertura, definição e URL crua. Um número sem procedência é uma afirmação sem prova |
| **MapaBrasil** (`geo/MapaBrasil.tsx`) | coroplético sobre malha do IBGE; rampa de tinta; caixas de chamada para os 7 estados pequenos; sem dado = `--ink-1`, estado próprio — nunca o extremo da escala |
| **GraficoArea** (`charts/GraficoArea.tsx`) | lazy-loaded (ECharts ~237 KB gzip). Grade reescrita inteira via `chartOptions` porque o escape hatch do evilcharts faz spread raso |
| **Estados** (`hud/Estados.tsx`) | carregando / falha / vazio, todos na mesma moldura tracejada |

## Densidade dos números

- Valores em tabela: mono 11px, tabular
- Valores na régua: mono 11px, compactos (`18,8 mil`)
- Eixos: `formatarEixo()` — casas decimais proporcionais à magnitude (`100` e não `100,00`)
- Unidade **sempre colada** ao número, nunca inferida

## Regra de honestidade visual

**Nada é colorido para sugerir juízo.** O app recusa-se a destacar "quem venceu" quando o
indicador não tem direção declarada (`direcao: null` cobre inflação, câmbio, juros e
carga tributária). Só mortalidade, pobreza e analfabetismo — que têm valência inequívoca —
destacam uma célula. Destacar o resto seria tomar partido onde o dado não toma.
