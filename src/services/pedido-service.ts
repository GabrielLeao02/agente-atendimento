import type { Pedido } from "../domain/pedido.js";
import { PedidoNaoEncontradoError } from "../errors/app-error.js";
import type { PedidoRepository } from "../repositories/pedido-repository.js";

export class PedidoService {
  constructor(private readonly pedidoRepository: PedidoRepository) {}

  async consultar(pedidoId: string, clienteId: string): Promise<Pedido> {
    const pedido = await this.pedidoRepository.buscarPorId(pedidoId);

    // Pedido de outro cliente recebe o mesmo erro de inexistente, para não revelar que ele existe
    if (!pedido || pedido.clienteId !== clienteId) {
      throw new PedidoNaoEncontradoError();
    }

    return pedido;
  }
}
