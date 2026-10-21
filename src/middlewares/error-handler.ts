import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError, DadosInvalidosError } from "../errors/app-error.js";
import { logger } from "../logger.js";

// O Express reconhece um middleware de erro pelos 4 parâmetros, por isso o `_next` precisa existir
export function errorHandler(erro: unknown, req: Request, res: Response, _next: NextFunction) {
  // Falha de validação do Zod vira DadosInvalidosError, para seguir o mesmo formato de resposta
  const erroTratado =
    erro instanceof ZodError ? new DadosInvalidosError(erro.issues.map((issue) => issue.message).join(" ")) : erro;

  if (erroTratado instanceof DadosInvalidosError) {
    logger.info(
      { evento: "requisicao_invalida", metodo: req.method, rota: req.path, mensagem: erroTratado.message },
      "Requisição com dados inválidos",
    );
  }

  if (erroTratado instanceof AppError) {
    res.status(erroTratado.status).json({ codigo: erroTratado.codigo, mensagem: erroTratado.message });
    return;
  }

  // Erro inesperado: registra com stack para investigação, mas não expõe detalhes internos na resposta
  logger.error({ evento: "erro_interno", metodo: req.method, rota: req.path, err: erroTratado }, "Erro inesperado");
  res.status(500).json({ codigo: "ERRO_INTERNO", mensagem: "Ocorreu um erro interno. Tente novamente mais tarde." });
}
