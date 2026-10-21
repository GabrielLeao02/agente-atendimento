import { Router } from "express";
import type { MensagemController } from "../controllers/mensagem-controller.js";

export function criarMensagemRoutes(mensagemController: MensagemController): Router {
  const router = Router();

  router.post("/", mensagemController.receber);

  return router;
}
