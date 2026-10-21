import { z } from "zod";
import { MENSAGENS_VALIDACAO } from "../errors/catalogo-erros.js";

export const mensagemBodySchema = z.object({
  texto: z
    .string({ error: MENSAGENS_VALIDACAO.textoObrigatorio })
    .trim()
    .min(1, MENSAGENS_VALIDACAO.textoTamanho)
    .max(1000, MENSAGENS_VALIDACAO.textoTamanho)
    .meta({ description: "Mensagem digitada pelo cliente", example: "Quero cancelar o pedido 1001" }),
});

export const respostaAgenteSchema = z
  .object({
    resposta: z.string().meta({
      description: "Resposta do agente para enviar ao cliente",
      example: "Encontrei o pedido 1001, que está em processamento. Você confirma o cancelamento dele?",
    }),
  })
  .meta({ id: "RespostaAgente" });
