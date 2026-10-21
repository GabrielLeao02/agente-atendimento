import type { StatusPedido } from "../domain/pedido.js";
import { CATALOGO_ERROS } from "./catalogo-erros.js";
import type { CodigoErro } from "./catalogo-erros.js";

export class AppError extends Error {
  public readonly status: number;

  constructor(
    public readonly codigo: CodigoErro,
    // Mensagem específica; se não vier, usa a padrão do catálogo
    mensagem: string = CATALOGO_ERROS[codigo].mensagem,
    // Campos extras que vão junto na resposta de erro (ex.: statusAtual no 409)
    public readonly detalhes: Record<string, unknown> = {},
  ) {
    super(mensagem);
    this.name = new.target.name;
    this.status = CATALOGO_ERROS[codigo].status;
  }
}

export class DadosInvalidosError extends AppError {
  constructor(mensagem?: string) {
    super("DADOS_INVALIDOS", mensagem);
  }
}

export class PedidoNaoEncontradoError extends AppError {
  constructor() {
    super("PEDIDO_NAO_ENCONTRADO");
  }
}

export class PedidoNaoCancelavelError extends AppError {
  constructor(statusAtual: StatusPedido) {
    super("PEDIDO_NAO_CANCELAVEL", undefined, { statusAtual });
  }
}

export class ErroInternoError extends AppError {
  constructor() {
    super("ERRO_INTERNO");
  }
}

export class AgenteIndisponivelError extends AppError {
  constructor() {
    super("AGENTE_INDISPONIVEL");
  }
}
