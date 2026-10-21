import { Router } from "express";
import type { PedidoController } from "../controllers/pedido-controller.js";

export function criarPedidoRoutes(pedidoController: PedidoController): Router {
  const router = Router();

  router.get("/:pedidoId", pedidoController.consultar);

  return router;
}
