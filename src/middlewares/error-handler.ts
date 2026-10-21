import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError, DadosInvalidosError } from "../errors/app-error.js";

// O Express reconhece um middleware de erro pelos 4 parâmetros, por isso o `_next` precisa existir
export function errorHandler(erro: unknown, _req: Request, res: Response, _next: NextFunction) {
  // Falha de validação do Zod vira DadosInvalidosError, para seguir o mesmo formato de resposta
  const erroTratado =
    erro instanceof ZodError ? new DadosInvalidosError(erro.issues.map((issue) => issue.message).join(" ")) : erro;

  if (erroTratado instanceof AppError) {
    res.status(erroTratado.status).json({ codigo: erroTratado.codigo, mensagem: erroTratado.message });
    return;
  }

  // Erro inesperado: registra para investigação, mas não expõe detalhes internos na resposta
  console.error(erroTratado);
  res.status(500).json({ codigo: "ERRO_INTERNO", mensagem: "Ocorreu um erro interno. Tente novamente mais tarde." });
}
