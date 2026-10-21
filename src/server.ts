import { app } from "./app.js";
import { logger } from "./logger.js";

const PORT = Number(process.env.PORT ?? 3000);

// No Express 5, falhas ao abrir a porta (ex.: porta ocupada) chegam como erro neste callback
app.listen(PORT, (erro) => {
  if (erro) {
    logger.fatal({ evento: "falha_ao_iniciar", porta: PORT, err: erro }, "Não foi possível iniciar o servidor");
    process.exit(1);
  }

  logger.info({ evento: "servidor_iniciado", porta: PORT }, `Servidor rodando em http://localhost:${PORT}`);
});
