import { beforeEach, describe, expect, it } from "vitest";
import { PedidoNaoCancelavelError, PedidoNaoEncontradoError } from "../../src/errors/app-error.js";
import { InMemoryPedidoRepository } from "../../src/repositories/in-memory-pedido-repository.js";
import { PedidoService } from "../../src/services/pedido-service.js";

const CLIENTE_A = "5511999990001";
const CLIENTE_B = "5511999990002";

// Pedidos de exemplo: 1001 em_processamento, 1002 enviado, 1003 entregue, 1004 cancelado (cliente A);
// 1005 em_processamento e 1006 enviado (cliente B)
let repositorio: InMemoryPedidoRepository;
let service: PedidoService;

beforeEach(() => {
  repositorio = new InMemoryPedidoRepository();
  service = new PedidoService(repositorio);
});

describe("PedidoService.consultar", () => {
  it("retorna o pedido quando ele pertence ao cliente", async () => {
    const pedido = await service.consultar("1001", CLIENTE_A);

    expect(pedido).toMatchObject({ id: "1001", clienteId: CLIENTE_A, status: "em_processamento" });
  });

  it("lança PedidoNaoEncontradoError quando o pedido não existe", async () => {
    await expect(service.consultar("9999", CLIENTE_A)).rejects.toBeInstanceOf(PedidoNaoEncontradoError);
  });

  it("lança o mesmo PedidoNaoEncontradoError quando o pedido é de outro cliente, sem revelar que ele existe", async () => {
    const erroOutroCliente = await service.consultar("1005", CLIENTE_A).catch((erro: unknown) => erro);
    const erroInexistente = await service.consultar("9999", CLIENTE_A).catch((erro: unknown) => erro);

    expect(erroOutroCliente).toBeInstanceOf(PedidoNaoEncontradoError);
    expect(erroOutroCliente).toMatchObject({ codigo: "PEDIDO_NAO_ENCONTRADO", status: 404, detalhes: {} });
    expect(erroOutroCliente).toEqual(erroInexistente);
  });
});

describe("PedidoService.cancelar", () => {
  it("cancela pedido em processamento do próprio cliente e atualiza a data", async () => {
    const antes = await service.consultar("1001", CLIENTE_A);

    const cancelado = await service.cancelar("1001", CLIENTE_A);

    expect(cancelado.status).toBe("cancelado");
    expect(cancelado.atualizadoEm > antes.atualizadoEm).toBe(true);
    expect((await service.consultar("1001", CLIENTE_A)).status).toBe("cancelado");
  });

  it.each([
    ["1002", "enviado"],
    ["1003", "entregue"],
    ["1004", "cancelado"],
  ] as const)("recusa cancelar o pedido %s (%s) e informa o status atual", async (pedidoId, statusAtual) => {
    const erro = await service.cancelar(pedidoId, CLIENTE_A).catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(PedidoNaoCancelavelError);
    expect(erro).toMatchObject({ codigo: "PEDIDO_NAO_CANCELAVEL", status: 409, detalhes: { statusAtual } });
    expect((await service.consultar(pedidoId, CLIENTE_A)).status).toBe(statusAtual);
  });

  it("recusa cancelar duas vezes o mesmo pedido, sem responder sucesso na segunda", async () => {
    await service.cancelar("1001", CLIENTE_A);

    await expect(service.cancelar("1001", CLIENTE_A)).rejects.toMatchObject({
      codigo: "PEDIDO_NAO_CANCELAVEL",
      detalhes: { statusAtual: "cancelado" },
    });
  });

  it("não cancela pedido de outro cliente e responde como se ele não existisse", async () => {
    await expect(service.cancelar("1005", CLIENTE_A)).rejects.toBeInstanceOf(PedidoNaoEncontradoError);
    expect((await service.consultar("1005", CLIENTE_B)).status).toBe("em_processamento");
  });

  it("não cancela pedido inexistente", async () => {
    await expect(service.cancelar("9999", CLIENTE_A)).rejects.toBeInstanceOf(PedidoNaoEncontradoError);
  });
});

describe("InMemoryPedidoRepository", () => {
  it("devolve cópias: alterar o objeto recebido não altera os dados guardados", async () => {
    const pedido = await repositorio.buscarPorId("1001");
    if (pedido) {
      pedido.status = "cancelado";
    }

    expect((await repositorio.buscarPorId("1001"))?.status).toBe("em_processamento");
  });

  it("cada instância começa com os dados de exemplo intactos", async () => {
    await new InMemoryPedidoRepository().atualizarStatus("1001", "cancelado");

    expect((await new InMemoryPedidoRepository().buscarPorId("1001"))?.status).toBe("em_processamento");
  });
});
