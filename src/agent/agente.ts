import { logger, mascararClienteId } from "../logger.js";
import type { InMemoryConversaStore } from "./conversa-store.js";
import { DEFINICOES_FERRAMENTAS } from "./ferramentas.js";
import type { ExecutorFerramentas } from "./ferramentas.js";
import { INSTRUCOES_AGENTE } from "./instrucoes.js";
import type { ModeloIA } from "./modelos/modelo-ia.js";

// Limite de idas e vindas entre modelo e ferramentas numa mesma mensagem, contra loops
const MAX_PASSOS = 6;

// Respostas fixas para quando não dá para confiar no modelo. Nenhuma afirma que algo foi feito (Regra 6)
export const RESPOSTA_FALHA =
  "Desculpe, estou com uma instabilidade e não consegui concluir seu atendimento agora. Nada foi alterado no seu pedido. Se preferir, posso te encaminhar para um atendente humano.";

export class Agente {
  constructor(
    private readonly modelo: ModeloIA,
    private readonly ferramentas: ExecutorFerramentas,
    private readonly conversas: InMemoryConversaStore,
  ) {}

  async responder(clienteId: string, texto: string): Promise<string> {
    const estado = this.conversas.obter(clienteId);
    const cliente = mascararClienteId(clienteId);
    const tamanhoAntes = estado.historico.length;

    estado.turno += 1;
    estado.historico.push({ papel: "cliente", texto });
    // O conteúdo da mensagem não vai para o log: pode conter dados pessoais
    logger.info({ evento: "mensagem_recebida", cliente, turno: estado.turno, tamanho: texto.length }, "Mensagem recebida");

    try {
      for (let passo = 1; passo <= MAX_PASSOS; passo++) {
        const resposta = await this.modelo.gerar(INSTRUCOES_AGENTE, estado.historico, DEFINICOES_FERRAMENTAS);

        if (resposta.tipo === "texto") {
          estado.historico.push({ papel: "agente", texto: resposta.texto });
          this.conversas.limitarHistorico(estado);
          logger.info(
            { evento: "resposta_enviada", cliente, turno: estado.turno, passos: passo, tamanho: resposta.texto.length },
            "Resposta do agente enviada",
          );
          return resposta.texto;
        }

        estado.historico.push({ papel: "agente", chamadas: resposta.chamadas });

        for (const chamada of resposta.chamadas) {
          const resultado = await this.ferramentas.executar(chamada, { clienteId, estado });
          estado.historico.push({ papel: "ferramenta", chamadaId: chamada.id, resultado });
        }
      }

      logger.warn({ evento: "agente_limite_de_passos", cliente, turno: estado.turno }, "Agente atingiu o limite de passos");
    } catch (erro) {
      logger.error({ evento: "agente_falhou", cliente, turno: estado.turno, err: erro }, "Falha ao gerar resposta do agente");
    }

    // Desfaz o turno incompleto (chamadas sem resposta quebrariam a próxima ida ao modelo)
    // e registra só a mensagem do cliente e a resposta segura
    estado.historico.splice(tamanhoAntes);
    estado.historico.push({ papel: "cliente", texto }, { papel: "agente", texto: RESPOSTA_FALHA });
    return RESPOSTA_FALHA;
  }
}
