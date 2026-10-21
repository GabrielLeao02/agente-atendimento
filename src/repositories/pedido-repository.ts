import type { Pedido } from "../domain/pedido.js";

export interface PedidoRepository {
  buscarPorId(id: string): Promise<Pedido | undefined>;
}
