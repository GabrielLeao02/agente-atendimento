import type { StatusPedido } from "../domain/pedido.js";

export class AppError extends Error {
  constructor(
    public readonly codigo: string,
    public readonly status: number,
    mensagem: string,
    // Campos extras que vão junto na resposta de erro (ex.: statusAtual no 409)
    public readonly detalhes: Record<string, unknown> = {},
  ) {
    super(mensagem);
    this.name = new.target.name;
  }
}

export class DadosInvalidosError extends AppError {
  constructor(mensagem: string) {
    super("DADOS_INVALIDOS", 400, mensagem);
  }
}

export class PedidoNaoEncontradoError extends AppError {
  constructor() {
    super("PEDIDO_NAO_ENCONTRADO", 404, "Pedido não encontrado.");
  }
}

export class PedidoNaoCancelavelError extends AppError {
  constructor(statusAtual: StatusPedido) {
    super(
      "PEDIDO_NAO_CANCELAVEL",
      409,
      "O pedido não pode ser cancelado porque não está mais em processamento.",
      { statusAtual },
    );
  }
}
