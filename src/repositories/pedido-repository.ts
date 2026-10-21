import type { Pedido, StatusPedido } from "../domain/pedido.js";

export interface PedidoRepository {
  buscarPorId(id: string): Promise<Pedido | undefined>;
  atualizarStatus(id: string, status: StatusPedido): Promise<Pedido | undefined>;
}
