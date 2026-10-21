import { OpenAPIRegistry, OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi";
import { clienteHeadersSchema, erroSchema, pedidoParamsSchema, pedidoSchema } from "../schemas/pedido-schemas.js";

const registry = new OpenAPIRegistry();

function respostaDeErro(descricao: string) {
  return { description: descricao, content: { "application/json": { schema: erroSchema } } };
}

registry.registerPath({
  method: "get",
  path: "/pedidos/{pedidoId}",
  tags: ["Pedidos"],
  summary: "Consulta um pedido",
  description: "Retorna o pedido somente se ele pertencer ao cliente informado no header. Pedido de outro cliente responde 404, igual a pedido inexistente.",
  request: {
    params: pedidoParamsSchema,
    headers: clienteHeadersSchema,
  },
  responses: {
    200: { description: "Pedido encontrado", content: { "application/json": { schema: pedidoSchema } } },
    400: respostaDeErro("Entrada inválida (DADOS_INVALIDOS)"),
    404: respostaDeErro("Pedido não encontrado ou de outro cliente (PEDIDO_NAO_ENCONTRADO)"),
    500: respostaDeErro("Erro técnico (ERRO_INTERNO)"),
  },
});

registry.registerPath({
  method: "get",
  path: "/health",
  tags: ["Saúde"],
  summary: "Verifica se a API está no ar",
  responses: {
    200: { description: "API funcionando" },
  },
});

export const documentoOpenApi = new OpenApiGeneratorV3(registry.definitions).generateDocument({
  openapi: "3.0.0",
  info: {
    title: "Agente de Atendimento - API principal",
    version: "1.0.0",
    description: "API de consulta e cancelamento de pedidos. Toda regra de negócio é validada aqui, nunca pelo agente de IA.",
  },
});
