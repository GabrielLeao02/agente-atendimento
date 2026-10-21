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

// Fonte única da regra de cancelamento: só pedidos ainda em processamento podem ser cancelados
// (Regras 2 e 3 do enunciado; entregue e cancelado são suposições documentadas)
export function podeSerCancelado(status: StatusPedido): boolean {
  return status === "em_processamento";
}
