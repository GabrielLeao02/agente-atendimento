import type { Pedido } from "../domain/pedido.js";
import { PedidoNaoEncontradoError } from "../errors/app-error.js";
import { logger, mascararClienteId } from "../logger.js";
import type { PedidoRepository } from "../repositories/pedido-repository.js";

export class PedidoService {
  constructor(private readonly pedidoRepository: PedidoRepository) {}

  async consultar(pedidoId: string, clienteId: string): Promise<Pedido> {
    const pedido = await this.pedidoRepository.buscarPorId(pedidoId);
    const cliente = mascararClienteId(clienteId);

    // Pedido de outro cliente recebe o mesmo erro de inexistente, para não revelar que ele existe
    if (!pedido || pedido.clienteId !== clienteId) {
      // O motivo real fica só no log interno: ajuda a detectar tentativas de acessar pedidos alheios
      logger.info(
        { evento: "pedido_nao_encontrado", pedidoId, cliente, motivo: pedido ? "outro_cliente" : "inexistente" },
        "Consulta de pedido sem resultado",
      );
      throw new PedidoNaoEncontradoError();
    }

    logger.info({ evento: "pedido_consultado", pedidoId, cliente, status: pedido.status }, "Pedido consultado");

    return pedido;
  }
}
