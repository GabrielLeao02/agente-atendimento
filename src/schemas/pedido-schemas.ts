import { z } from "zod";
import type { Pedido } from "../domain/pedido.js";

// Os metadados em .meta() não mudam a validação: só alimentam a documentação do Swagger

export const pedidoParamsSchema = z.object({
  pedidoId: z
    .string()
    .regex(/^\d+$/, "O número do pedido deve conter apenas dígitos.")
    .meta({ description: "Número do pedido", example: "1001" }),
});

// O clienteId vem do canal de mensageria (telefone com DDI), nunca do texto digitado pelo cliente
export const clienteHeadersSchema = z.object({
  "x-cliente-id": z
    .string({ error: "O header x-cliente-id é obrigatório." })
    .regex(/^\d{10,15}$/, "O header x-cliente-id deve conter de 10 a 15 dígitos.")
    .meta({ description: "Identificador do cliente vindo do canal de mensageria (telefone com DDI)", example: "5511999990001" }),
});

const statusPedidoSchema = z.enum(["em_processamento", "enviado", "entregue", "cancelado"]);

// Schemas de resposta: usados só na documentação. A anotação z.ZodType<Pedido> faz o TypeScript
// acusar erro se este schema ficar diferente do tipo Pedido do domínio
export const pedidoSchema: z.ZodType<Pedido> = z
  .object({
    id: z.string().meta({ example: "1001" }),
    clienteId: z.string().meta({ example: "5511999990001" }),
    status: statusPedidoSchema,
    itens: z.array(
      z.object({
        produtoId: z.number().int().meta({ description: "Id do produto na Fake Store API", example: 1 }),
        quantidade: z.number().int().meta({ example: 2 }),
      }),
    ),
    criadoEm: z.string().meta({ description: "Data em ISO 8601", example: "2026-10-18T13:20:00.000Z" }),
    atualizadoEm: z.string().meta({ description: "Data em ISO 8601", example: "2026-10-18T13:20:00.000Z" }),
  })
  .meta({ id: "Pedido" });

export const erroSchema = z
  .object({
    codigo: z.string().meta({ description: "Código que identifica o tipo de erro", example: "PEDIDO_NAO_ENCONTRADO" }),
    mensagem: z.string().meta({ description: "Descrição legível do erro", example: "Pedido não encontrado." }),
  })
  .meta({ id: "Erro" });

export const erroNaoCancelavelSchema = erroSchema
  .extend({
    codigo: z.literal("PEDIDO_NAO_CANCELAVEL"),
    mensagem: z.string().meta({ example: "O pedido não pode ser cancelado porque não está mais em processamento." }),
    statusAtual: statusPedidoSchema.meta({ description: "Status atual do pedido", example: "enviado" }),
  })
  .meta({ id: "ErroPedidoNaoCancelavel" });
