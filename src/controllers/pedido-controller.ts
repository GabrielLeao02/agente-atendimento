import type { Request, Response } from "express";
import { DadosInvalidosError } from "../errors/app-error.js";
import type { PedidoService } from "../services/pedido-service.js";

export class PedidoController {
  constructor(private readonly pedidoService: PedidoService) {}

  // Arrow function para manter o `this` quando o Express chama o método como callback
  consultar = async (req: Request<{ pedidoId: string }>, res: Response) => {
    const clienteId = req.header("x-cliente-id");

    // Validação provisória: será substituída pelo Zod
    if (!clienteId) {
      throw new DadosInvalidosError("O header x-cliente-id é obrigatório.");
    }

    const pedido = await this.pedidoService.consultar(req.params.pedidoId, clienteId);

    res.status(200).json(pedido);
  };
}
