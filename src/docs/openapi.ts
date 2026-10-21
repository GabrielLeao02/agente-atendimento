import { OpenAPIRegistry, OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi";
import {
  clienteHeadersSchema,
  erroNaoCancelavelSchema,
  erroSchema,
  pedidoParamsSchema,
  pedidoSchema,
} from "../schemas/pedido-schemas.js";
import { mensagemBodySchema, respostaAgenteSchema } from "../schemas/mensagem-schemas.js";

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
  method: "post",
  path: "/pedidos/{pedidoId}/cancelamento",
  tags: ["Pedidos"],
  summary: "Solicita o cancelamento de um pedido",
  description:
    "Cancela o pedido somente se ele pertencer ao cliente e ainda estiver em processamento. Pedidos enviados, entregues ou já cancelados respondem 409 com o status atual.",
  request: {
    params: pedidoParamsSchema,
    headers: clienteHeadersSchema,
  },
  responses: {
    200: { description: "Pedido cancelado", content: { "application/json": { schema: pedidoSchema } } },
    400: respostaDeErro("Entrada inválida (DADOS_INVALIDOS)"),
    404: respostaDeErro("Pedido não encontrado ou de outro cliente (PEDIDO_NAO_ENCONTRADO)"),
    409: {
      description: "Pedido não pode ser cancelado (PEDIDO_NAO_CANCELAVEL)",
      content: { "application/json": { schema: erroNaoCancelavelSchema } },
    },
    500: respostaDeErro("Erro técnico (ERRO_INTERNO)"),
  },
});

registry.registerPath({
  method: "post",
  path: "/mensagens",
  tags: ["Agente"],
  summary: "Envia uma mensagem do cliente ao agente de IA (mock do canal de mensageria)",
  description:
    "Simula o webhook de um canal como o WhatsApp. O cliente é identificado pelo header x-cliente-id, vindo do canal, e a conversa é mantida por cliente. O agente interpreta a mensagem, chama as ferramentas da API e responde. Cancelamentos exigem confirmação do cliente numa mensagem seguinte.",
  request: {
    headers: clienteHeadersSchema,
    body: { content: { "application/json": { schema: mensagemBodySchema } } },
  },
  responses: {
    200: { description: "Resposta do agente", content: { "application/json": { schema: respostaAgenteSchema } } },
    400: respostaDeErro("Entrada inválida (DADOS_INVALIDOS)"),
    503: respostaDeErro("Agente sem provedor de IA configurado (AGENTE_INDISPONIVEL)"),
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
