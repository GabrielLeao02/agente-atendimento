// Ponto único de todos os códigos de erro e textos devolvidos pela API.
// Os códigos são o contrato com o agente de IA (ele decide o que dizer pelo código, não pelo texto).
// Para trocar o idioma das respostas, basta traduzir as mensagens deste arquivo.

export const CATALOGO_ERROS = {
  DADOS_INVALIDOS: { status: 400, mensagem: "Os dados enviados são inválidos." },
  PEDIDO_NAO_ENCONTRADO: { status: 404, mensagem: "Pedido não encontrado." },
  PEDIDO_NAO_CANCELAVEL: {
    status: 409,
    mensagem: "O pedido não pode ser cancelado porque não está mais em processamento.",
  },
  ERRO_INTERNO: { status: 500, mensagem: "Ocorreu um erro interno. Tente novamente mais tarde." },
  AGENTE_INDISPONIVEL: {
    status: 503,
    mensagem: "O agente de atendimento não está configurado. Defina a variável OPENAI_API_KEY.",
  },
} as const satisfies Record<string, { status: number; mensagem: string }>;

export type CodigoErro = keyof typeof CATALOGO_ERROS;

export const CODIGOS_ERRO = Object.keys(CATALOGO_ERROS) as [CodigoErro, ...CodigoErro[]];

export const MENSAGENS_VALIDACAO = {
  pedidoIdApenasDigitos: "O número do pedido deve conter apenas dígitos.",
  clienteIdObrigatorio: "O header x-cliente-id é obrigatório.",
  clienteIdFormato: "O header x-cliente-id deve conter de 10 a 15 dígitos.",
  jsonMalformado: "O corpo da requisição não é um JSON válido.",
  textoObrigatorio: "O campo texto é obrigatório.",
  textoTamanho: "O campo texto deve ter entre 1 e 1000 caracteres.",
} as const;
