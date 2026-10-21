import OpenAI from "openai";
import { logger } from "../../logger.js";
import { ModeloComLog } from "./modelo-com-log.js";
import type { ModeloIA } from "./modelo-ia.js";
import { OpenAIModelo } from "./openai-modelo.js";

// Fábrica do provedor de IA, escolhido pela variável AI_PROVIDER.
// Para usar outra IA: criar a classe dela implementando ModeloIA e adicionar um case aqui.
export function criarModeloIA(): ModeloIA | undefined {
  const provedor = process.env.AI_PROVIDER || "openai";
  const modelo = criarPorProvedor(provedor);

  if (!modelo) {
    return undefined;
  }

  logger.info({ evento: "agente_habilitado", provedor: modelo.provedor, modelo: modelo.nome }, "Agente de IA habilitado");
  return new ModeloComLog(modelo);
}

function criarPorProvedor(provedor: string): ModeloIA | undefined {
  switch (provedor) {
    case "openai": {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        logger.warn({ evento: "agente_desabilitado", provedor }, "OPENAI_API_KEY não definida: rota /mensagens responderá 503");
        return undefined;
      }
      const cliente = new OpenAI({ apiKey, timeout: 30_000, maxRetries: 1 });
      return new OpenAIModelo(cliente, process.env.OPENAI_MODEL || "gpt-5-mini");
    }

    default:
      logger.warn({ evento: "agente_desabilitado", provedor }, "AI_PROVIDER desconhecido: rota /mensagens responderá 503");
      return undefined;
  }
}
