import type { Pedido } from "../domain/pedido.js";
import type { PedidoRepository } from "./pedido-repository.js";

const CLIENTE_A = "5511999990001";
const CLIENTE_B = "5511999990002";

export const pedidosExemplo: Pedido[] = [
  {
    id: "1001",
    clienteId: CLIENTE_A,
    status: "em_processamento",
    itens: [
      { produtoId: 1, quantidade: 1 },
      { produtoId: 5, quantidade: 2 },
    ],
    criadoEm: "2026-10-18T13:20:00.000Z",
    atualizadoEm: "2026-10-18T13:20:00.000Z",
  },
  {
    id: "1002",
    clienteId: CLIENTE_A,
    status: "enviado",
    itens: [{ produtoId: 9, quantidade: 1 }],
    criadoEm: "2026-10-12T09:45:00.000Z",
    atualizadoEm: "2026-10-14T16:10:00.000Z",
  },
  {
    id: "1003",
    clienteId: CLIENTE_A,
    status: "entregue",
    itens: [{ produtoId: 3, quantidade: 1 }],
    criadoEm: "2026-09-28T18:05:00.000Z",
    atualizadoEm: "2026-10-03T11:30:00.000Z",
  },
  {
    id: "1004",
    clienteId: CLIENTE_A,
    status: "cancelado",
    itens: [{ produtoId: 14, quantidade: 1 }],
    criadoEm: "2026-10-05T20:15:00.000Z",
    atualizadoEm: "2026-10-06T08:00:00.000Z",
  },
  {
    id: "1005",
    clienteId: CLIENTE_B,
    status: "em_processamento",
    itens: [{ produtoId: 7, quantidade: 3 }],
    criadoEm: "2026-10-19T10:00:00.000Z",
    atualizadoEm: "2026-10-19T10:00:00.000Z",
  },
  {
    id: "1006",
    clienteId: CLIENTE_B,
    status: "enviado",
    itens: [
      { produtoId: 2, quantidade: 1 },
      { produtoId: 18, quantidade: 1 },
    ],
    criadoEm: "2026-10-10T14:30:00.000Z",
    atualizadoEm: "2026-10-13T09:00:00.000Z",
  },
];

export class InMemoryPedidoRepository implements PedidoRepository {
  private readonly pedidos: Map<string, Pedido>;

  constructor(pedidosIniciais: Pedido[] = pedidosExemplo) {
    // Copia os dados para que alterações aqui não mexam na lista original
    this.pedidos = new Map(pedidosIniciais.map((pedido) => [pedido.id, structuredClone(pedido)]));
  }

  async buscarPorId(id: string): Promise<Pedido | undefined> {
    const pedido = this.pedidos.get(id);

    // Devolve uma cópia para que quem recebe não altere o "banco" sem querer
    return pedido ? structuredClone(pedido) : undefined;
  }
}
