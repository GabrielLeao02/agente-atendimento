import { logger } from "../../logger.js";
import type { MensagemConversa } from "../tipos.js";
import type { DefinicaoFerramenta, ModeloIA, RespostaModelo } from "./modelo-ia.js";

// Envolve qualquer provedor e registra cada chamada à IA (uma API externa): duração, tokens e
// tipo de resposta. Fica fora dos adaptadores para todo provedor novo já nascer com logs.
// Nunca registra o conteúdo enviado ou recebido, que pode ter dados pessoais do cliente.
export class ModeloComLog implements ModeloIA {
  readonly provedor: string;
  readonly nome: string;

  constructor(private readonly modelo: ModeloIA) {
    this.provedor = modelo.provedor;
    this.nome = modelo.nome;
  }

  async gerar(instrucoes: string, historico: MensagemConversa[], ferramentas: DefinicaoFerramenta[]): Promise<RespostaModelo> {
    const inicio = performance.now();
    const base = { provedor: this.provedor, modelo: this.nome, mensagensEnviadas: historico.length };

    try {
      const resposta = await this.modelo.gerar(instrucoes, historico, ferramentas);

      logger.info(
        {
          evento: "ia_chamada",
          ...base,
          duracaoMs: Math.round(performance.now() - inicio),
          resultado: resposta.tipo,
          ferramentas: resposta.tipo === "ferramentas" ? resposta.chamadas.map((chamada) => chamada.nome) : undefined,
          tamanhoResposta: resposta.tipo === "texto" ? resposta.texto.length : undefined,
          ...resposta.metadados,
        },
        "Chamada à IA concluída",
      );

      return resposta;
    } catch (erro) {
      // Os SDKs costumam expor status HTTP e request id no erro; lidos sem depender de um provedor
      const detalhes = erro as { status?: unknown; requestID?: unknown; name?: unknown };

      logger.warn(
        {
          evento: "ia_falhou",
          ...base,
          duracaoMs: Math.round(performance.now() - inicio),
          status: detalhes.status,
          requestId: detalhes.requestID ?? undefined,
          tipoErro: detalhes.name,
        },
        "Chamada à IA falhou",
      );

      throw erro;
    }
  }
}
