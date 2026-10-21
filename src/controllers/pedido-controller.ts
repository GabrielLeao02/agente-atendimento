import type { Request, Response } from "express";
import { clienteHeadersSchema, pedidoParamsSchema } from "../schemas/pedido-schemas.js";
import type { PedidoService } from "../services/pedido-service.js";

export class PedidoController {
  constructor(private readonly pedidoService: PedidoService) {}

  // Arrow function para manter o `this` quando o Express chama o método como callback
  consultar = async (req: Request, res: Response) => {
    // Se a entrada for inválida, o parse lança ZodError e o errorHandler responde 400
    const { pedidoId } = pedidoParamsSchema.parse(req.params);
    const { "x-cliente-id": clienteId } = clienteHeadersSchema.parse(req.headers);

    const pedido = await this.pedidoService.consultar(pedidoId, clienteId);

    res.status(200).json(pedido);
  };
}
