import type { MensagemConversa } from "./tipos.js";

const LIMITE_HISTORICO = 40;

export interface EstadoConversa {
  historico: MensagemConversa[];
  // Conta as mensagens do cliente; usado para exigir que a confirmação venha numa mensagem nova
  turno: number;
  // Cancelamento que o agente propôs e aguarda o "sim" do cliente. Só o código cria e consome isso
  cancelamentoPendente?: { pedidoId: string; turno: number };
}

// Conversas em memória, uma por cliente (identificado pelo canal de mensageria)
export class InMemoryConversaStore {
  private readonly conversas = new Map<string, EstadoConversa>();

  obter(clienteId: string): EstadoConversa {
    let estado = this.conversas.get(clienteId);

    if (!estado) {
      estado = { historico: [], turno: 0 };
      this.conversas.set(clienteId, estado);
    }

    return estado;
  }

  // Mantém o histórico limitado, sempre cortando no início de uma mensagem do cliente
  // para não separar uma chamada de ferramenta do seu resultado
  limitarHistorico(estado: EstadoConversa): void {
    if (estado.historico.length <= LIMITE_HISTORICO) {
      return;
    }

    let inicio = estado.historico.length - LIMITE_HISTORICO;
    while (inicio < estado.historico.length && estado.historico[inicio]?.papel !== "cliente") {
      inicio++;
    }

    estado.historico = estado.historico.slice(inicio);
  }
}
