export type StatusPedido = "em_processamento" | "enviado" | "entregue" | "cancelado";

export interface ItemPedido {
  produtoId: number; // id do produto na Fake Store API
  quantidade: number;
}

export interface Pedido {
  id: string;
  clienteId: string;
  status: StatusPedido;
  itens: ItemPedido[];
  criadoEm: string; // ISO 8601
  atualizadoEm: string; // ISO 8601
}
