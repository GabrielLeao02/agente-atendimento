import { describe, expect, it } from "vitest";
import { ModeloComLog } from "../../src/agent/modelos/modelo-com-log.js";
import type { ModeloIA, RespostaModelo } from "../../src/agent/modelos/modelo-ia.js";

function modeloQue(acao: () => Promise<RespostaModelo>): ModeloIA {
  return { provedor: "simulado", nome: "teste", gerar: acao };
}

describe("ModeloComLog", () => {
  it("repassa a resposta do provedor sem alterá-la", async () => {
    const resposta: RespostaModelo = { tipo: "texto", texto: "Olá!", metadados: { tokensEntrada: 10, tokensSaida: 2 } };
    const modelo = new ModeloComLog(modeloQue(async () => resposta));

    expect(await modelo.gerar("instruções", [], [])).toBe(resposta);
    expect(modelo.provedor).toBe("simulado");
    expect(modelo.nome).toBe("teste");
  });

  it("propaga o erro do provedor depois de registrar a falha", async () => {
    const erro = Object.assign(new Error("rate limit"), { status: 429 });
    const modelo = new ModeloComLog(
      modeloQue(async () => {
        throw erro;
      }),
    );

    await expect(modelo.gerar("instruções", [], [])).rejects.toBe(erro);
  });
});
