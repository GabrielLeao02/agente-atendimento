// Formato próprio da conversa, independente do provedor de IA. O adaptador de cada provedor
// (ex.: OpenAI) traduz deste formato para o dele, então trocar de provedor não muda o agente.

export interface ChamadaFerramenta {
  id: string;
  nome: string;
  argumentos: string; // JSON gerado pelo modelo; validado com Zod antes de qualquer uso
}

export type MensagemConversa =
  | { papel: "cliente"; texto: string }
  | { papel: "agente"; texto: string }
  | { papel: "agente"; chamadas: ChamadaFerramenta[] }
  | { papel: "ferramenta"; chamadaId: string; resultado: unknown };

export type RespostaModelo = { tipo: "texto"; texto: string } | { tipo: "ferramentas"; chamadas: ChamadaFerramenta[] };

export interface DefinicaoFerramenta {
  nome: string;
  descricao: string;
  parametros: Record<string, unknown>; // JSON Schema dos argumentos
}

export interface ModeloIA {
  gerar(instrucoes: string, historico: MensagemConversa[], ferramentas: DefinicaoFerramenta[]): Promise<RespostaModelo>;
}
