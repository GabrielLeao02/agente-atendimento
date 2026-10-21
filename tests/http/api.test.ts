import { once } from "node:events";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { Agente } from "../../src/agent/agente.js";
import { InMemoryConversaStore } from "../../src/agent/conversa-store.js";
import { ExecutorFerramentas } from "../../src/agent/ferramentas.js";
import type { ModeloIA } from "../../src/agent/modelos/modelo-ia.js";
import { criarApp } from "../../src/app.js";
import type { DependenciasApp } from "../../src/app.js";
import { FakeStoreClient } from "../../src/integrations/fake-store-client.js";
import type { PedidoRepository } from "../../src/repositories/pedido-repository.js";

const CLIENTE_A = "5511999990001";

let servidor: Server | undefined;

// Sobe um app novo numa porta livre; sem agente por padrão, para não depender do .env
async function iniciarApi(dependencias: DependenciasApp = {}): Promise<string> {
  servidor = criarApp({ criarAgente: () => undefined, ...dependencias }).listen(0);
  await once(servidor, "listening");
  return `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
}

afterEach(async () => {
  if (servidor) {
    servidor.close();
    await once(servidor, "close");
    servidor = undefined;
  }
});

function comCliente(clienteId: string, init: RequestInit = {}): RequestInit {
  return { ...init, headers: { "x-cliente-id": clienteId, "Content-Type": "application/json", ...init.headers } };
}

describe("GET /pedidos/:pedidoId", () => {
  it("200 com o pedido do próprio cliente", async () => {
    const api = await iniciarApi();

    const resposta = await fetch(`${api}/pedidos/1001`, comCliente(CLIENTE_A));

    expect(resposta.status).toBe(200);
    expect(await resposta.json()).toMatchObject({ id: "1001", status: "em_processamento" });
  });

  it("404 PEDIDO_NAO_ENCONTRADO para pedido inexistente", async () => {
    const api = await iniciarApi();

    const resposta = await fetch(`${api}/pedidos/9999`, comCliente(CLIENTE_A));

    expect(resposta.status).toBe(404);
    expect(await resposta.json()).toEqual({ codigo: "PEDIDO_NAO_ENCONTRADO", mensagem: "Pedido não encontrado." });
  });

  it("404 idêntico para pedido de outro cliente, sem revelar que ele existe", async () => {
    const api = await iniciarApi();

    const outroCliente = await fetch(`${api}/pedidos/1005`, comCliente(CLIENTE_A));
    const inexistente = await fetch(`${api}/pedidos/9999`, comCliente(CLIENTE_A));

    expect(outroCliente.status).toBe(404);
    expect(await outroCliente.json()).toEqual(await inexistente.json());
  });

  it.each([
    ["pedidoId com letras", "/pedidos/abc", { "x-cliente-id": CLIENTE_A }, "O número do pedido deve conter apenas dígitos."],
    ["sem header x-cliente-id", "/pedidos/1001", {}, "O header x-cliente-id é obrigatório."],
    ["x-cliente-id fora do formato", "/pedidos/1001", { "x-cliente-id": "oi" }, "O header x-cliente-id deve conter de 10 a 15 dígitos."],
  ])("400 DADOS_INVALIDOS: %s", async (_cenario, caminho, headers, mensagem) => {
    const api = await iniciarApi();

    const resposta = await fetch(`${api}${caminho}`, { headers });

    expect(resposta.status).toBe(400);
    expect(await resposta.json()).toEqual({ codigo: "DADOS_INVALIDOS", mensagem });
  });
});

describe("POST /pedidos/:pedidoId/cancelamento", () => {
  it("200 com o pedido cancelado, e a consulta seguinte mostra o novo status", async () => {
    const api = await iniciarApi();

    const resposta = await fetch(`${api}/pedidos/1001/cancelamento`, comCliente(CLIENTE_A, { method: "POST" }));
    const consulta = await fetch(`${api}/pedidos/1001`, comCliente(CLIENTE_A));

    expect(resposta.status).toBe(200);
    expect(await resposta.json()).toMatchObject({ id: "1001", status: "cancelado" });
    expect(await consulta.json()).toMatchObject({ status: "cancelado" });
  });

  it.each([
    ["1002", "enviado"],
    ["1003", "entregue"],
    ["1004", "cancelado"],
  ])("409 PEDIDO_NAO_CANCELAVEL para o pedido %s (%s), com o status atual", async (pedidoId, statusAtual) => {
    const api = await iniciarApi();

    const resposta = await fetch(`${api}/pedidos/${pedidoId}/cancelamento`, comCliente(CLIENTE_A, { method: "POST" }));

    expect(resposta.status).toBe(409);
    expect(await resposta.json()).toEqual({
      codigo: "PEDIDO_NAO_CANCELAVEL",
      mensagem: "O pedido não pode ser cancelado porque não está mais em processamento.",
      statusAtual,
    });
  });

  it("404 ao tentar cancelar pedido de outro cliente, que continua em processamento", async () => {
    const api = await iniciarApi();

    const resposta = await fetch(`${api}/pedidos/1005/cancelamento`, comCliente(CLIENTE_A, { method: "POST" }));
    const consultaDoDono = await fetch(`${api}/pedidos/1005`, comCliente("5511999990002"));

    expect(resposta.status).toBe(404);
    expect(await consultaDoDono.json()).toMatchObject({ status: "em_processamento" });
  });

  it("400 para JSON malformado no corpo, sem alterar o pedido", async () => {
    const api = await iniciarApi();

    const resposta = await fetch(`${api}/pedidos/1001/cancelamento`, comCliente(CLIENTE_A, { method: "POST", body: "{quebrado" }));
    const consulta = await fetch(`${api}/pedidos/1001`, comCliente(CLIENTE_A));

    expect(resposta.status).toBe(400);
    expect(await resposta.json()).toEqual({ codigo: "DADOS_INVALIDOS", mensagem: "O corpo da requisição não é um JSON válido." });
    expect(await consulta.json()).toMatchObject({ status: "em_processamento" });
  });
});

describe("Erro técnico", () => {
  it("500 ERRO_INTERNO sem expor detalhes internos quando o repositório falha", async () => {
    const repositorioQuebrado: PedidoRepository = {
      buscarPorId: async () => {
        throw new Error("conexão recusada em db-interno:5432 usuario=admin");
      },
      atualizarStatus: async () => undefined,
    };
    const api = await iniciarApi({ pedidoRepository: repositorioQuebrado });

    const resposta = await fetch(`${api}/pedidos/1001`, comCliente(CLIENTE_A));
    const corpo = await resposta.text();

    expect(resposta.status).toBe(500);
    expect(JSON.parse(corpo)).toEqual({ codigo: "ERRO_INTERNO", mensagem: "Ocorreu um erro interno. Tente novamente mais tarde." });
    expect(corpo).not.toContain("db-interno");
  });
});

describe("POST /mensagens", () => {
  it("503 AGENTE_INDISPONIVEL quando não há provedor de IA, sem derrubar o resto da API", async () => {
    const api = await iniciarApi();

    const mensagem = await fetch(`${api}/mensagens`, comCliente(CLIENTE_A, { method: "POST", body: JSON.stringify({ texto: "oi" }) }));
    const consulta = await fetch(`${api}/pedidos/1001`, comCliente(CLIENTE_A));

    expect(mensagem.status).toBe(503);
    expect(await mensagem.json()).toMatchObject({ codigo: "AGENTE_INDISPONIVEL" });
    expect(consulta.status).toBe(200);
  });

  it("200 com a resposta do agente, usando o cliente do header", async () => {
    const modelo: ModeloIA = { provedor: "simulado", nome: "fixo", gerar: async () => ({ tipo: "texto", texto: "Olá! Como posso ajudar?" }) };
    const api = await iniciarApi({
      criarAgente: (pedidoService) =>
        new Agente(modelo, new ExecutorFerramentas(pedidoService, new FakeStoreClient()), new InMemoryConversaStore()),
    });

    const resposta = await fetch(`${api}/mensagens`, comCliente(CLIENTE_A, { method: "POST", body: JSON.stringify({ texto: "oi" }) }));

    expect(resposta.status).toBe(200);
    expect(await resposta.json()).toEqual({ resposta: "Olá! Como posso ajudar?" });
  });

  it("400 quando o texto está vazio", async () => {
    const api = await iniciarApi();

    const resposta = await fetch(`${api}/mensagens`, comCliente(CLIENTE_A, { method: "POST", body: JSON.stringify({ texto: "   " }) }));

    expect(resposta.status).toBe(400);
    expect(await resposta.json()).toMatchObject({ codigo: "DADOS_INVALIDOS" });
  });
});

describe("Infraestrutura", () => {
  it("GET /health responde ok", async () => {
    const api = await iniciarApi();

    const resposta = await fetch(`${api}/health`);

    expect(resposta.status).toBe(200);
    expect(await resposta.json()).toEqual({ status: "ok" });
  });

  it("não anuncia o framework no header x-powered-by", async () => {
    const api = await iniciarApi();

    const resposta = await fetch(`${api}/health`);

    expect(resposta.headers.get("x-powered-by")).toBeNull();
  });
});
