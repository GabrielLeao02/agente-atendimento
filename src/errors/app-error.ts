export class AppError extends Error {
  constructor(
    public readonly codigo: string,
    public readonly status: number,
    mensagem: string,
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
