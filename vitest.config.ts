import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    // Silencia os logs da aplicação para a saída dos testes ficar limpa
    env: { LOG_LEVEL: "silent" },
  },
});
