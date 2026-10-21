import OpenAI from "openai";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";
import type { DefinicaoFerramenta, MensagemConversa, ModeloIA, RespostaModelo } from "./tipos.js";

// Adaptador da OpenAI: traduz a conversa do nosso formato para o da API de chat completions
export class OpenAIModelo implements ModeloIA {
  constructor(
    private readonly cliente: OpenAI,
    private readonly modelo: string,
  ) {}

  async gerar(instrucoes: string, historico: MensagemConversa[], ferramentas: DefinicaoFerramenta[]): Promise<RespostaModelo> {
    const resposta = await this.cliente.chat.completions.create({
      model: this.modelo,
      messages: [{ role: "developer", content: instrucoes }, ...historico.map(paraMensagemOpenAI)],
      tools: ferramentas.map(paraFerramentaOpenAI),
    });

    const mensagem = resposta.choices[0]?.message;
    if (!mensagem) {
      throw new Error("Resposta da OpenAI sem mensagem");
    }

    const chamadas = (mensagem.tool_calls ?? []).flatMap((chamada) =>
      chamada.type === "function" ? [{ id: chamada.id, nome: chamada.function.name, argumentos: chamada.function.arguments }] : [],
    );

    if (chamadas.length > 0) {
      return { tipo: "ferramentas", chamadas };
    }

    if (!mensagem.content) {
      throw new Error("Resposta da OpenAI sem texto nem chamadas de ferramenta");
    }

    return { tipo: "texto", texto: mensagem.content };
  }
}

function paraMensagemOpenAI(mensagem: MensagemConversa): ChatCompletionMessageParam {
  if (mensagem.papel === "cliente") {
    return { role: "user", content: mensagem.texto };
  }

  if (mensagem.papel === "ferramenta") {
    return { role: "tool", tool_call_id: mensagem.chamadaId, content: JSON.stringify(mensagem.resultado) };
  }

  if ("chamadas" in mensagem) {
    return {
      role: "assistant",
      tool_calls: mensagem.chamadas.map((chamada) => ({
        id: chamada.id,
        type: "function",
        function: { name: chamada.nome, arguments: chamada.argumentos },
      })),
    };
  }

  return { role: "assistant", content: mensagem.texto };
}

function paraFerramentaOpenAI(ferramenta: DefinicaoFerramenta): ChatCompletionTool {
  return {
    type: "function",
    function: { name: ferramenta.nome, description: ferramenta.descricao, parameters: ferramenta.parametros },
  };
}
