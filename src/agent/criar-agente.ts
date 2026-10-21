import OpenAI from "openai";
import type { FakeStoreClient } from "../integrations/fake-store-client.js";
import { logger } from "../logger.js";
import type { PedidoService } from "../services/pedido-service.js";
import { Agente } from "./agente.js";
import { InMemoryConversaStore } from "./conversa-store.js";
import { ExecutorFerramentas } from "./ferramentas.js";
import { OpenAIModelo } from "./openai-modelo.js";

// Monta o agente com a OpenAI se houver chave; sem chave, devolve undefined e a rota responde 503
export function criarAgente(pedidoService: PedidoService, fakeStoreClient: FakeStoreClient): Agente | undefined {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    logger.warn({ evento: "agente_desabilitado" }, "OPENAI_API_KEY não definida: rota /mensagens responderá 503");
    return undefined;
  }

  const modelo = process.env.OPENAI_MODEL || "gpt-5-mini";
  const cliente = new OpenAI({ apiKey, timeout: 30_000, maxRetries: 1 });

  logger.info({ evento: "agente_habilitado", modelo }, "Agente de IA habilitado");

  return new Agente(
    new OpenAIModelo(cliente, modelo),
    new ExecutorFerramentas(pedidoService, fakeStoreClient),
    new InMemoryConversaStore(),
  );
}
