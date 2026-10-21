import { z } from "zod";
import { logger } from "../logger.js";

// Só os campos que o agente pode usar. A descrição do produto é texto de terceiros, não confiável
// (pode conter prompt injection), por isso nem é lida daqui.
const produtoFakeStoreSchema = z.object({
  id: z.number().int(),
  title: z.string().min(1),
  price: z.number().nonnegative(),
  category: z.string().min(1),
});

export interface Produto {
  id: number;
  nome: string;
  categoria: string;
  preco: number;
}

export type MotivoFalhaProduto = "UNAVAILABLE" | "INVALID_RESPONSE" | "NOT_FOUND";

// Resultado explícito: quem chama é obrigado a tratar a falha, e o cliente nunca lança erro para fora
export type ResultadoProduto = { ok: true; product: Produto } | { ok: false; reason: MotivoFalhaProduto };

interface FakeStoreClientOpcoes {
  baseUrl?: string;
  timeoutMs?: number;
  // Injetável para os testes simularem respostas sem chamar a API de verdade
  fetchFn?: typeof fetch;
}

export class FakeStoreClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;

  constructor(opcoes: FakeStoreClientOpcoes = {}) {
    this.baseUrl = opcoes.baseUrl ?? process.env.FAKE_STORE_URL ?? "https://fakestoreapi.com";
    this.timeoutMs = opcoes.timeoutMs ?? Number(process.env.FAKE_STORE_TIMEOUT_MS ?? 3000);
    this.fetchFn = opcoes.fetchFn ?? fetch;
  }

  async getProduct(produtoId: number): Promise<ResultadoProduto> {
    const inicio = performance.now();
    const { resultado, causa } = await this.buscarProduto(produtoId);
    const duracaoMs = Math.round(performance.now() - inicio);

    if (resultado.ok) {
      logger.info({ evento: "fake_store_consultada", produtoId, duracaoMs }, "Produto obtido da Fake Store");
    } else {
      logger.warn(
        { evento: "fake_store_falhou", produtoId, motivo: resultado.reason, causa, duracaoMs },
        "Falha ao obter produto da Fake Store",
      );
    }

    return resultado;
  }

  // A causa detalhada vai só para o log; para fora sai apenas o motivo padronizado
  private async buscarProduto(produtoId: number): Promise<{ resultado: ResultadoProduto; causa?: string }> {
    let resposta: Response;
    let corpo: string;

    try {
      // O mesmo sinal de timeout cobre a conexão e a leitura do corpo
      const signal = AbortSignal.timeout(this.timeoutMs);
      resposta = await this.fetchFn(`${this.baseUrl}/products/${produtoId}`, { signal });
      corpo = await resposta.text();
    } catch (erro) {
      const causa = erro instanceof Error && erro.name === "TimeoutError" ? "timeout" : "erro_de_rede";
      return { resultado: { ok: false, reason: "UNAVAILABLE" }, causa };
    }

    if (resposta.status === 404) {
      return { resultado: { ok: false, reason: "NOT_FOUND" }, causa: "status_404" };
    }

    if (resposta.status >= 500) {
      return { resultado: { ok: false, reason: "UNAVAILABLE" }, causa: `status_${resposta.status}` };
    }

    if (!resposta.ok) {
      return { resultado: { ok: false, reason: "INVALID_RESPONSE" }, causa: `status_${resposta.status}` };
    }

    // A Fake Store responde 200 com corpo vazio para produto inexistente (comportamento observado)
    if (corpo.trim() === "") {
      return { resultado: { ok: false, reason: "NOT_FOUND" }, causa: "corpo_vazio" };
    }

    let json: unknown;
    try {
      json = JSON.parse(corpo);
    } catch {
      return { resultado: { ok: false, reason: "INVALID_RESPONSE" }, causa: "json_invalido" };
    }

    const validacao = produtoFakeStoreSchema.safeParse(json);
    if (!validacao.success) {
      return { resultado: { ok: false, reason: "INVALID_RESPONSE" }, causa: "formato_inesperado" };
    }

    const { id, title, category, price } = validacao.data;

    return { resultado: { ok: true, product: { id, nome: title, categoria: category, preco: price } } };
  }
}
