import type { ChamadaFerramenta, MensagemConversa } from "../tipos.js";

// Contrato que todo provedor de IA implementa, no mesmo papel do PedidoRepository: o agente
// depende só desta interface. Trocar de IA é criar outra implementação e escolhê-la na fábrica.

export interface DefinicaoFerramenta {
  nome: string;
  descricao: string;
  parametros: Record<string, unknown>; // JSON Schema dos argumentos
}

// Dados da chamada para os logs (sem conteúdo da conversa); cada provedor preenche o que tiver
export interface MetadadosChamada {
  tokensEntrada?: number;
  tokensSaida?: number;
  requestId?: string;
}

export type RespostaModelo = (
  | { tipo: "texto"; texto: string }
  | { tipo: "ferramentas"; chamadas: ChamadaFerramenta[] }
) & { metadados?: MetadadosChamada };

export interface ModeloIA {
  readonly provedor: string;
  readonly nome: string;
  gerar(instrucoes: string, historico: MensagemConversa[], ferramentas: DefinicaoFerramenta[]): Promise<RespostaModelo>;
}
