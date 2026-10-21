import type { FakeStoreClient } from "../integrations/fake-store-client.js";
import type { PedidoService } from "../services/pedido-service.js";
import { Agente } from "./agente.js";
import { InMemoryConversaStore } from "./conversa-store.js";
import { ExecutorFerramentas } from "./ferramentas.js";
import { criarModeloIA } from "./modelos/criar-modelo.js";

// Monta o agente com o provedor de IA configurado; sem provedor, devolve undefined e a rota responde 503
export function criarAgente(pedidoService: PedidoService, fakeStoreClient: FakeStoreClient): Agente | undefined {
  const modelo = criarModeloIA();

  if (!modelo) {
    return undefined;
  }

  return new Agente(modelo, new ExecutorFerramentas(pedidoService, fakeStoreClient), new InMemoryConversaStore());
}
