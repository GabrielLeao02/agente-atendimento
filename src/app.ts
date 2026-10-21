import express from "express";
import type { Express, Request, Response } from "express";
import swaggerUi from "swagger-ui-express";
import type { Agente } from "./agent/agente.js";
import { criarAgente } from "./agent/criar-agente.js";
import { MensagemController } from "./controllers/mensagem-controller.js";
import { PedidoController } from "./controllers/pedido-controller.js";
import { documentoOpenApi } from "./docs/openapi.js";
import { FakeStoreClient } from "./integrations/fake-store-client.js";
import { errorHandler } from "./middlewares/error-handler.js";
import { InMemoryPedidoRepository } from "./repositories/in-memory-pedido-repository.js";
import type { PedidoRepository } from "./repositories/pedido-repository.js";
import { criarMensagemRoutes } from "./routes/mensagem-routes.js";
import { criarPedidoRoutes } from "./routes/pedido-routes.js";
import { PedidoService } from "./services/pedido-service.js";

// Dependências que podem ser trocadas (ex.: nos testes). O que não for informado usa o padrão
export interface DependenciasApp {
  pedidoRepository?: PedidoRepository;
  criarAgente?: (pedidoService: PedidoService) => Agente | undefined;
}

// Fábrica: cada chamada monta um app novo, com os próprios dados. Nos testes, isso isola um teste
// do outro (cancelar um pedido num teste não afeta o seguinte)
export function criarApp(dependencias: DependenciasApp = {}): Express {
  // Montagem das dependências: cada camada recebe a de baixo pelo construtor
  const pedidoRepository = dependencias.pedidoRepository ?? new InMemoryPedidoRepository();
  const pedidoService = new PedidoService(pedidoRepository);
  const pedidoController = new PedidoController(pedidoService);

  // O agente usa o mesmo PedidoService da API: as regras de negócio são as mesmas para os dois
  const montarAgente = dependencias.criarAgente ?? ((service: PedidoService) => criarAgente(service, new FakeStoreClient()));
  const mensagemController = new MensagemController(montarAgente(pedidoService));

  const app = express();

  // Não anuncia o framework no header das respostas
  app.disable("x-powered-by");

  app.use(express.json());

  app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({ status: "ok" });
  });

  app.use("/pedidos", criarPedidoRoutes(pedidoController));

  app.use("/mensagens", criarMensagemRoutes(mensagemController));

  app.use("/docs", swaggerUi.serve, swaggerUi.setup(documentoOpenApi));

  // Precisa ser o último middleware, para pegar os erros de todas as rotas acima
  app.use(errorHandler);

  return app;
}
