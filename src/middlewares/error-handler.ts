import type { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/app-error.js";

// O Express reconhece um middleware de erro pelos 4 parâmetros, por isso o `_next` precisa existir
export function errorHandler(erro: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (erro instanceof AppError) {
    res.status(erro.status).json({ codigo: erro.codigo, mensagem: erro.message });
    return;
  }

  // Erro inesperado: registra para investigação, mas não expõe detalhes internos na resposta
  console.error(erro);
  res.status(500).json({ codigo: "ERRO_INTERNO", mensagem: "Ocorreu um erro interno. Tente novamente mais tarde." });
}
