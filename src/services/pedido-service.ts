import { podeSerCancelado } from "../domain/pedido.js";
import type { Pedido } from "../domain/pedido.js";
import { PedidoNaoCancelavelError, PedidoNaoEncontradoError } from "../errors/app-error.js";
import { logger, mascararClienteId } from "../logger.js";
import type { PedidoRepository } from "../repositories/pedido-repository.js";

type Operacao = "consulta" | "cancelamento";

export class PedidoService {
  constructor(private readonly pedidoRepository: PedidoRepository) {}

  async consultar(pedidoId: string, clienteId: string): Promise<Pedido> {
    const pedido = await this.buscarPedidoDoCliente(pedidoId, clienteId, "consulta");

    logger.info(
      { evento: "pedido_consultado", pedidoId, cliente: mascararClienteId(clienteId), status: pedido.status },
      "Pedido consultado",
    );

    return pedido;
  }

  async cancelar(pedidoId: string, clienteId: string): Promise<Pedido> {
    const pedido = await this.buscarPedidoDoCliente(pedidoId, clienteId, "cancelamento");
    const cliente = mascararClienteId(clienteId);

    // A decisão é da API: o agente de IA nunca decide sozinho se um pedido pode ser cancelado
    if (!podeSerCancelado(pedido.status)) {
      logger.info(
        { evento: "cancelamento_recusado", pedidoId, cliente, statusAtual: pedido.status },
        "Cancelamento recusado pela regra de negócio",
      );
      throw new PedidoNaoCancelavelError(pedido.status);
    }

    const pedidoCancelado = await this.pedidoRepository.atualizarStatus(pedidoId, "cancelado");

    // O pedido existia na busca acima; se sumiu agora, é falha técnica, nunca sucesso
    if (!pedidoCancelado) {
      throw new Error(`Pedido ${pedidoId} não encontrado ao atualizar o status`);
    }

    logger.info({ evento: "pedido_cancelado", pedidoId, cliente }, "Pedido cancelado");

    return pedidoCancelado;
  }

  // Busca o pedido e garante que ele pertence ao cliente. Pedido de outro cliente recebe o mesmo
  // erro de inexistente, para não revelar que ele existe
  private async buscarPedidoDoCliente(pedidoId: string, clienteId: string, operacao: Operacao): Promise<Pedido> {
    const pedido = await this.pedidoRepository.buscarPorId(pedidoId);

    if (!pedido || pedido.clienteId !== clienteId) {
      // O motivo real fica só no log interno: ajuda a detectar tentativas de acessar pedidos alheios
      logger.info(
        {
          evento: "pedido_nao_encontrado",
          operacao,
          pedidoId,
          cliente: mascararClienteId(clienteId),
          motivo: pedido ? "outro_cliente" : "inexistente",
        },
        "Pedido não encontrado para o cliente",
      );
      throw new PedidoNaoEncontradoError();
    }

    return pedido;
  }
}
