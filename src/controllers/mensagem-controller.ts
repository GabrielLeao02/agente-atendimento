import type { Request, Response } from "express";
import type { Agente } from "../agent/agente.js";
import { AgenteIndisponivelError } from "../errors/app-error.js";
import { mensagemBodySchema } from "../schemas/mensagem-schemas.js";
import { clienteHeadersSchema } from "../schemas/pedido-schemas.js";

// Mock do canal de mensageria: recebe a mensagem como um webhook de WhatsApp receberia
export class MensagemController {
  // Sem chave da OpenAI o agente não existe, mas o resto da API continua funcionando
  constructor(private readonly agente: Agente | undefined) {}

  receber = async (req: Request, res: Response) => {
    // O cliente é identificado pelo canal (header), nunca pelo que ele escreve no texto
    const { "x-cliente-id": clienteId } = clienteHeadersSchema.parse(req.headers);
    const { texto } = mensagemBodySchema.parse(req.body ?? {});

    if (!this.agente) {
      throw new AgenteIndisponivelError();
    }

    const resposta = await this.agente.responder(clienteId, texto);

    res.status(200).json({ resposta });
  };
}
