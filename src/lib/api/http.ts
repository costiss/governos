/**
 * Camada HTTP. Existe por um motivo só: as APIs públicas brasileiras são
 * servidas por infraestrutura estatal e não têm SLA para uso abusivo.
 *
 * Três freios, aplicados por host:
 *   1. teto de concorrência  — nunca mais de N chamadas simultâneas;
 *   2. espaçamento mínimo    — um intervalo entre chamadas consecutivas;
 *   3. respeito a `Retry-After` — 429/503 pausam o host, não a requisição.
 *
 * O cache é do TanStack Query (memória + IndexedDB). Aqui é só cortesia de rede.
 */

const TETO_CONCORRENCIA: Record<string, number> = {
  "apisidra.ibge.gov.br": 2,
  "www.ipeadata.gov.br": 2,
  "api.bcb.gov.br": 2,
  "servicodados.ibge.gov.br": 2,
};

const ESPACAMENTO_MS: Record<string, number> = {
  "apisidra.ibge.gov.br": 300,
  "www.ipeadata.gov.br": 300,
  "api.bcb.gov.br": 200,
  "servicodados.ibge.gov.br": 250,
};

const PADRAO_CONCORRENCIA = 2;
const PADRAO_ESPACAMENTO = 300;
const JANELA_PAUSA_MS = 30_000;

interface EstadoHost {
  ativos: number;
  fila: Array<() => void>;
  ultimaChamada: number;
  pausadoAte: number;
}

const estados = new Map<string, EstadoHost>();

function estadoDe(host: string): EstadoHost {
  let estado = estados.get(host);
  if (!estado) {
    estado = { ativos: 0, fila: [], ultimaChamada: 0, pausadoAte: 0 };
    estados.set(host, estado);
  }
  return estado;
}

const dormir = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Reserva um slot no host: espera a pausa, o espaçamento e o teto de concorrência. */
async function aguardarVez(host: string): Promise<void> {
  const estado = estadoDe(host);
  const teto = TETO_CONCORRENCIA[host] ?? PADRAO_CONCORRENCIA;

  if (estado.ativos >= teto) {
    await new Promise<void>((resolve) => estado.fila.push(resolve));
  }
  estado.ativos += 1;

  const agora = Date.now();
  const pausa = Math.max(0, estado.pausadoAte - agora);
  const espacamento = ESPACAMENTO_MS[host] ?? PADRAO_ESPACAMENTO;
  const intervalo = Math.max(0, estado.ultimaChamada + espacamento - agora);
  const espera = Math.max(pausa, intervalo);
  if (espera > 0) await dormir(espera);

  estado.ultimaChamada = Date.now();
}

function liberarVez(host: string): void {
  const estado = estadoDe(host);
  estado.ativos -= 1;
  const proximo = estado.fila.shift();
  if (proximo) proximo();
}

function pausarHost(host: string, ms: number): void {
  const estado = estadoDe(host);
  estado.pausadoAte = Math.max(estado.pausadoAte, Date.now() + ms);
}

/** Lê `Retry-After` (segundos ou data HTTP) e devolve o valor em ms. */
function lerRetryAfter(resposta: Response): number {
  const bruto = resposta.headers.get("retry-after");
  if (!bruto) return JANELA_PAUSA_MS;
  const segundos = Number(bruto);
  if (Number.isFinite(segundos)) return Math.min(segundos * 1000, 120_000);
  const data = Date.parse(bruto);
  if (Number.isFinite(data)) return Math.min(Math.max(0, data - Date.now()), 120_000);
  return JANELA_PAUSA_MS;
}

export class ErroHttp extends Error {
  readonly status: number;
  readonly url: string;

  constructor(message: string, status: number, url: string) {
    super(message);
    this.name = "ErroHttp";
    this.status = status;
    this.url = url;
  }
}

/**
 * Prazo padrão por tentativa.
 *
 * Não é paranoia: o SGS do Banco Central trava ~30 s em algumas janelas antes de
 * estourar o próprio timeout — e a página de erro dele sai SEM o cabeçalho
 * CORS, o que o navegador reporta como bloqueio de CORS. Sem prazo aqui, cada
 * tentativa espera os 30 s, e três tentativas por fatia viram minutos de tela
 * carregando. Com prazo, a tentativa morre cedo e a repetição costuma pegar o
 * dado já aquecido no servidor.
 */
const PRAZO_PADRAO_MS = 12_000;

/** Combina o sinal do chamador com um prazo. O do chamador manda: é cancelamento. */
function sinalComPrazo(signal: AbortSignal | undefined, ms: number): AbortSignal {
  const prazo = AbortSignal.timeout(ms);
  return signal ? AbortSignal.any([signal, prazo]) : prazo;
}

export interface OpcoesRequisicao {
  /** Identificador do recurso para diagnóstico e mensagens de erro. */
  rotulo?: string;
  signal?: AbortSignal;
  headers?: Record<string, string>;
  tentativas?: number;
  /** Prazo por tentativa, em ms. */
  prazoMs?: number;
}

/**
 * GET educado: passa pelo limitador do host, tenta de novo em falha
 * transitória com backoff exponencial e respeita `Retry-After` em 429/503.
 */
export async function buscarJson<T>(url: string, opcoes: OpcoesRequisicao = {}): Promise<T> {
  const { rotulo = url, signal, headers, tentativas = 3, prazoMs = PRAZO_PADRAO_MS } = opcoes;
  const host = new URL(url).host;
  let ultimoErro: unknown;

  for (let tentativa = 0; tentativa < tentativas; tentativa += 1) {
    if (signal?.aborted) throw new DOMException("Requisição cancelada", "AbortError");

    await aguardarVez(host);
    try {
      const resposta = await fetch(url, {
        signal: sinalComPrazo(signal, prazoMs),
        headers: { Accept: "application/json", ...headers },
      });

      if (resposta.status === 429 || resposta.status === 503) {
        const espera = lerRetryAfter(resposta);
        pausarHost(host, espera);
        throw new ErroHttp(`Limite de requisições atingido em ${host}`, resposta.status, url);
      }

      if (!resposta.ok) {
        // 4xx que não seja 429 é defeito nosso: repetir não adianta.
        if (resposta.status < 500) {
          throw new ErroHttp(
            `Falha ao ler ${rotulo} (HTTP ${resposta.status})`,
            resposta.status,
            url,
          );
        }
        throw new ErroHttp(`Servidor indisponível em ${host}`, resposta.status, url);
      }

      return (await resposta.json()) as T;
    } catch (erro) {
      // Cancelamento pelo chamador é definitivo; estouro de prazo é transitório.
      if (signal?.aborted) throw new DOMException("Requisição cancelada", "AbortError");
      if (erro instanceof DOMException && erro.name === "AbortError") throw erro;

      // Erro definitivo do cliente: não gastar tentativas.
      if (erro instanceof ErroHttp && erro.status >= 400 && erro.status < 500 && erro.status !== 429) {
        throw erro;
      }

      ultimoErro = erro;
      if (tentativa < tentativas - 1) {
        await dormir(Math.min(500 * 2 ** tentativa, 8_000));
      }
    } finally {
      liberarVez(host);
    }
  }

  throw ultimoErro instanceof Error
    ? ultimoErro
    : new Error(`Não foi possível ler ${rotulo}`);
}

/** Busca um recurso textual com o mesmo tratamento (útil para XML/SVG do IBGE). */
export async function buscarTexto(url: string, opcoes: OpcoesRequisicao = {}): Promise<string> {
  const { rotulo = url, signal, headers, tentativas = 3, prazoMs = PRAZO_PADRAO_MS } = opcoes;
  const host = new URL(url).host;
  let ultimoErro: unknown;

  for (let tentativa = 0; tentativa < tentativas; tentativa += 1) {
    if (signal?.aborted) throw new DOMException("Requisição cancelada", "AbortError");
    await aguardarVez(host);
    try {
      const resposta = await fetch(url, { signal: sinalComPrazo(signal, prazoMs), headers });
      if (!resposta.ok) {
        if (resposta.status === 429 || resposta.status === 503) {
          pausarHost(host, lerRetryAfter(resposta));
        }
        throw new ErroHttp(`Falha ao ler ${rotulo} (HTTP ${resposta.status})`, resposta.status, url);
      }
      return await resposta.text();
    } catch (erro) {
      if (signal?.aborted) throw new DOMException("Requisição cancelada", "AbortError");
      if (erro instanceof DOMException && erro.name === "AbortError") throw erro;
      if (erro instanceof ErroHttp && erro.status >= 400 && erro.status < 500 && erro.status !== 429) {
        throw erro;
      }
      ultimoErro = erro;
      if (tentativa < tentativas - 1) await dormir(Math.min(500 * 2 ** tentativa, 8_000));
    } finally {
      liberarVez(host);
    }
  }
  throw ultimoErro instanceof Error ? ultimoErro : new Error(`Não foi possível ler ${rotulo}`);
}
