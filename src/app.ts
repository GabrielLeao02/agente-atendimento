import express from "express";
import type { Request, Response } from "express";
import swaggerUi from "swagger-ui-express";
import { PedidoController } from "./controllers/pedido-controller.js";
import { documentoOpenApi } from "./docs/openapi.js";
import { errorHandler } from "./middlewares/error-handler.js";
import { InMemoryPedidoRepository } from "./repositories/in-memory-pedido-repository.js";
import { criarPedidoRoutes } from "./routes/pedido-routes.js";
import { PedidoService } from "./services/pedido-service.js";

// Montagem das dependências: cada camada recebe a de baixo pelo construtor
const pedidoRepository = new InMemoryPedidoRepository();
const pedidoService = new PedidoService(pedidoRepository);
const pedidoController = new PedidoController(pedidoService);

export const app = express();

app.use(express.json());

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

app.use("/pedidos", criarPedidoRoutes(pedidoController));

app.use("/docs", swaggerUi.serve, swaggerUi.setup(documentoOpenApi));

// Precisa ser o último middleware, para pegar os erros de todas as rotas acima
app.use(errorHandler);
