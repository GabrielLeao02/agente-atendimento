import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError, DadosInvalidosError, ErroInternoError } from "../errors/app-error.js";
import { MENSAGENS_VALIDACAO } from "../errors/catalogo-erros.js";
import { logger } from "../logger.js";

// O express.json() marca o erro de corpo que não é JSON válido com type "entity.parse.failed"
function ehJsonMalformado(erro: unknown): boolean {
  return erro instanceof SyntaxError && "type" in erro && erro.type === "entity.parse.failed";
}

// Erros de entrada (Zod ou JSON malformado) viram DadosInvalidosError, para seguir o mesmo formato de resposta
function converterErroDeEntrada(erro: unknown): unknown {
  if (erro instanceof ZodError) {
    return new DadosInvalidosError(erro.issues.map((issue) => issue.message).join(" "));
  }

  if (ehJsonMalformado(erro)) {
    return new DadosInvalidosError(MENSAGENS_VALIDACAO.jsonMalformado);
  }

  return erro;
}

// O Express reconhece um middleware de erro pelos 4 parâmetros, por isso o `_next` precisa existir
export function errorHandler(erro: unknown, req: Request, res: Response, _next: NextFunction) {
  const erroTratado = converterErroDeEntrada(erro);

  if (erroTratado instanceof DadosInvalidosError) {
    logger.info(
      { evento: "requisicao_invalida", metodo: req.method, rota: req.path, mensagem: erroTratado.message },
      "Requisição com dados inválidos",
    );
  }

  if (!(erroTratado instanceof AppError)) {
    // Erro inesperado: registra com stack para investigação, mas não expõe detalhes internos na resposta
    logger.error({ evento: "erro_interno", metodo: req.method, rota: req.path, err: erroTratado }, "Erro inesperado");
  }

  const resposta = erroTratado instanceof AppError ? erroTratado : new ErroInternoError();

  res.status(resposta.status).json({ codigo: resposta.codigo, mensagem: resposta.message, ...resposta.detalhes });
}
