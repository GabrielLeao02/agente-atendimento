import { pino } from "pino";

const emProducao = process.env.NODE_ENV === "production";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  // Nível por nome ("info") e data em ISO 8601, mais legíveis que o padrão numérico do pino
  formatters: { level: (label) => ({ level: label }) },
  timestamp: pino.stdTimeFunctions.isoTime,
  // Rede de segurança: se algum dado sensível for logado por engano, ele sai censurado
  redact: {
    paths: ["clienteId", "*.clienteId", 'headers["x-cliente-id"]', "*.headers.authorization", "apiKey", "*.apiKey"],
    censor: "[REMOVIDO]",
  },
  // Em produção (Docker), JSON puro para ferramentas de monitoramento; em desenvolvimento, saída legível
  ...(emProducao
    ? {}
    : { transport: { target: "pino-pretty", options: { translateTime: "SYS:HH:MM:ss", ignore: "pid,hostname" } } }),
});

// Mantém só os 4 últimos dígitos, o suficiente para correlacionar eventos sem expor o telefone
export function mascararClienteId(clienteId: string): string {
  return `***${clienteId.slice(-4)}`;
}
