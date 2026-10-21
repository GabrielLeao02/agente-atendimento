import { z } from "zod";
import { podeSerCancelado } from "../domain/pedido.js";
import type { Pedido, StatusPedido } from "../domain/pedido.js";
import { AppError } from "../errors/app-error.js";
import type { FakeStoreClient } from "../integrations/fake-store-client.js";
import { logger, mascararClienteId } from "../logger.js";
import type { PedidoService } from "../services/pedido-service.js";
import type { EstadoConversa } from "./conversa-store.js";
import type { DefinicaoFerramenta } from "./modelos/modelo-ia.js";
import type { ChamadaFerramenta } from "./tipos.js";

const pedidoIdSchema = z.string().regex(/^\d+$/).describe("Número do pedido informado pelo cliente (apenas dígitos)");

const argumentosSchemas = {
  consultar_pedido: z.object({ pedidoId: pedidoIdSchema }),
  preparar_cancelamento: z.object({ pedidoId: pedidoIdSchema }),
  confirmar_cancelamento: z.object({ pedidoId: pedidoIdSchema }),
  get_product_info: z.object({ produtoId: z.number().int().positive().describe("produtoId de um item do pedido") }),
  transferir_para_humano: z.object({
    motivo: z
      .enum(["fora_do_escopo", "pedido_nao_cancelavel", "falha_tecnica", "pedido_do_cliente"])
      .describe("Motivo do encaminhamento"),
  }),
};

type NomeFerramenta = keyof typeof argumentosSchemas;

const descricoes: Record<NomeFerramenta, string> = {
  consultar_pedido: "Consulta o status e os itens de um pedido do cliente atual.",
  preparar_cancelamento:
    "Primeira etapa do cancelamento: verifica se o pedido pode ser cancelado e registra que o cliente precisa confirmar. Não cancela nada.",
  confirmar_cancelamento:
    "Segunda etapa: cancela o pedido. Use somente depois que o cliente confirmou explicitamente, em uma nova mensagem, o cancelamento preparado.",
  get_product_info: "Obtém nome, categoria e preço de um produto de um item do pedido.",
  transferir_para_humano: "Encaminha o cliente para o atendimento humano.",
};

function paraJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const { $schema: _ignorado, ...jsonSchema } = z.toJSONSchema(schema);
  return jsonSchema;
}

export const DEFINICOES_FERRAMENTAS: DefinicaoFerramenta[] = (Object.keys(argumentosSchemas) as NomeFerramenta[]).map(
  (nome) => ({ nome, descricao: descricoes[nome], parametros: paraJsonSchema(argumentosSchemas[nome]) }),
);

// Códigos que só existem na conversa com o modelo (além dos códigos de erro da API)
type CodigoFerramenta = "CONFIRMACAO_NECESSARIA" | "PRODUTO_INDISPONIVEL" | "FERRAMENTA_DESCONHECIDA";

export type ResultadoFerramenta = { ok: true; [campo: string]: unknown } | { ok: false; codigo: string; [campo: string]: unknown };

export interface ContextoFerramenta {
  // Vem do canal de mensageria, nunca dos argumentos que o modelo envia
  clienteId: string;
  estado: EstadoConversa;
}

const DESCRICAO_STATUS: Record<StatusPedido, string> = {
  em_processamento: "em processamento",
  enviado: "enviado",
  entregue: "entregue",
  cancelado: "cancelado",
};

function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

// O que vai para o modelo: sem o clienteId, e com status e datas já no formato de exibição,
// para o modelo não precisar converter (e não errar ao converter)
function resumirPedido(pedido: Pedido) {
  return {
    id: pedido.id,
    status: pedido.status,
    statusParaCliente: DESCRICAO_STATUS[pedido.status],
    itens: pedido.itens,
    criadoEm: formatarData(pedido.criadoEm),
    atualizadoEm: formatarData(pedido.atualizadoEm),
  };
}

function falha(codigo: CodigoFerramenta, extras: Record<string, unknown> = {}): ResultadoFerramenta {
  return { ok: false, codigo, ...extras };
}

export class ExecutorFerramentas {
  constructor(
    private readonly pedidoService: PedidoService,
    private readonly fakeStoreClient: FakeStoreClient,
  ) {}

  async executar(chamada: ChamadaFerramenta, contexto: ContextoFerramenta): Promise<ResultadoFerramenta> {
    const resultado = await this.executarComSeguranca(chamada, contexto);

    logger.info(
      {
        evento: "ferramenta_executada",
        ferramenta: chamada.nome,
        cliente: mascararClienteId(contexto.clienteId),
        ok: resultado.ok,
        codigo: resultado.ok ? undefined : resultado.codigo,
      },
      "Ferramenta do agente executada",
    );

    return resultado;
  }

  private async executarComSeguranca(chamada: ChamadaFerramenta, contexto: ContextoFerramenta): Promise<ResultadoFerramenta> {
    if (!(chamada.nome in argumentosSchemas)) {
      return falha("FERRAMENTA_DESCONHECIDA");
    }

    const nome = chamada.nome as NomeFerramenta;

    let argumentosBrutos: unknown;
    try {
      argumentosBrutos = JSON.parse(chamada.argumentos);
    } catch {
      return { ok: false, codigo: "DADOS_INVALIDOS" };
    }

    const validacao = argumentosSchemas[nome].safeParse(argumentosBrutos);
    if (!validacao.success) {
      return { ok: false, codigo: "DADOS_INVALIDOS" };
    }

    try {
      return await this.despachar(nome, validacao.data, contexto);
    } catch (erro) {
      // Erros esperados da API viram o mesmo código que a API HTTP devolveria
      if (erro instanceof AppError) {
        return { ok: false, codigo: erro.codigo, ...erro.detalhes };
      }

      logger.error({ evento: "ferramenta_falhou", ferramenta: nome, err: erro }, "Erro inesperado em ferramenta do agente");
      return { ok: false, codigo: "ERRO_INTERNO" };
    }
  }

  private async despachar(nome: NomeFerramenta, argumentos: unknown, contexto: ContextoFerramenta): Promise<ResultadoFerramenta> {
    switch (nome) {
      case "consultar_pedido":
        return this.consultarPedido(argumentosSchemas.consultar_pedido.parse(argumentos), contexto);
      case "preparar_cancelamento":
        return this.prepararCancelamento(argumentosSchemas.preparar_cancelamento.parse(argumentos), contexto);
      case "confirmar_cancelamento":
        return this.confirmarCancelamento(argumentosSchemas.confirmar_cancelamento.parse(argumentos), contexto);
      case "get_product_info":
        return this.obterProduto(argumentosSchemas.get_product_info.parse(argumentos));
      case "transferir_para_humano":
        return this.transferirParaHumano(argumentosSchemas.transferir_para_humano.parse(argumentos), contexto);
    }
  }

  private async consultarPedido({ pedidoId }: { pedidoId: string }, { clienteId }: ContextoFerramenta) {
    const pedido = await this.pedidoService.consultar(pedidoId, clienteId);
    return { ok: true as const, pedido: resumirPedido(pedido) };
  }

  private async prepararCancelamento({ pedidoId }: { pedidoId: string }, { clienteId, estado }: ContextoFerramenta) {
    const pedido = await this.pedidoService.consultar(pedidoId, clienteId);

    // Checagem antecipada só para não pedir confirmação à toa; a decisão final continua no cancelar() da API
    if (!podeSerCancelado(pedido.status)) {
      return { ok: false as const, codigo: "PEDIDO_NAO_CANCELAVEL", statusAtual: pedido.status };
    }

    estado.cancelamentoPendente = { pedidoId, turno: estado.turno };
    return { ok: true as const, aguardandoConfirmacaoDoCliente: true, pedido: resumirPedido(pedido) };
  }

  // A confirmação é controlada pelo código: só cancela se o cancelamento deste pedido foi preparado
  // na mensagem anterior do cliente e a mensagem atual é a resposta dele
  private async confirmarCancelamento({ pedidoId }: { pedidoId: string }, { clienteId, estado }: ContextoFerramenta) {
    const pendente = estado.cancelamentoPendente;
    const confirmacaoValida = pendente?.pedidoId === pedidoId && pendente.turno === estado.turno - 1;

    if (!confirmacaoValida) {
      return falha("CONFIRMACAO_NECESSARIA");
    }

    // A pendência é consumida em qualquer resultado: uma confirmação vale para uma única tentativa
    delete estado.cancelamentoPendente;

    const pedido = await this.pedidoService.cancelar(pedidoId, clienteId);
    return { ok: true as const, pedido: resumirPedido(pedido) };
  }

  private async obterProduto({ produtoId }: { produtoId: number }) {
    const resultado = await this.fakeStoreClient.getProduct(produtoId);

    if (!resultado.ok) {
      return falha("PRODUTO_INDISPONIVEL");
    }

    const { nome, categoria, preco } = resultado.product;
    return { ok: true as const, produto: { nome, categoria, preco } };
  }

  private async transferirParaHumano({ motivo }: { motivo: string }, { clienteId, estado }: ContextoFerramenta) {
    // Mock: num canal real, aqui a conversa entraria na fila do atendimento humano
    delete estado.cancelamentoPendente;
    logger.info({ evento: "transferido_para_humano", motivo, cliente: mascararClienteId(clienteId) }, "Cliente encaminhado para atendimento humano");
    return { ok: true as const, encaminhado: true };
  }
}
