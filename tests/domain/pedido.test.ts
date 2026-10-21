import { describe, expect, it } from "vitest";
import { podeSerCancelado } from "../../src/domain/pedido.js";
import type { StatusPedido } from "../../src/domain/pedido.js";

describe("podeSerCancelado", () => {
  const casos: Array<[StatusPedido, boolean, string]> = [
    ["em_processamento", true, "Regra 2: só pedido em processamento pode ser cancelado"],
    ["enviado", false, "Regra 3: pedido enviado não pode ser cancelado pelo fluxo automatizado"],
    ["entregue", false, "Suposição: se enviado não pode, entregue também não"],
    ["cancelado", false, "Suposição: pedido já cancelado não é cancelado de novo"],
  ];

  it.each(casos)("status %s → %s (%s)", (status, esperado) => {
    expect(podeSerCancelado(status)).toBe(esperado);
  });
});
