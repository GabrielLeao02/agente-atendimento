import { z } from "zod";

export const pedidoParamsSchema = z.object({
  pedidoId: z.string().regex(/^\d+$/, "O número do pedido deve conter apenas dígitos."),
});

// O clienteId vem do canal de mensageria (telefone com DDI), nunca do texto digitado pelo cliente
export const clienteHeadersSchema = z.object({
  "x-cliente-id": z
    .string({ error: "O header x-cliente-id é obrigatório." })
    .regex(/^\d{10,15}$/, "O header x-cliente-id deve conter de 10 a 15 dígitos."),
});
