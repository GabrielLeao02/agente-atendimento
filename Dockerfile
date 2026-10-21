# Etapa 1: todas as dependências (inclusive as de desenvolvimento), base para dev, testes e build
FROM node:24-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Etapa 2: ambiente de desenvolvimento (usado pelos serviços dev e test do docker-compose)
FROM deps AS dev
COPY tsconfig*.json vitest.config.ts ./
COPY src ./src
COPY tests ./tests
EXPOSE 3000
CMD ["npm", "run", "dev"]

# Etapa 3: checa tipos, roda os testes e compila. Se algum teste falhar, a imagem de produção não é gerada
FROM dev AS build
RUN npm run typecheck && npm test && npm run build

# Etapa 4: imagem final, só com o necessário para rodar
FROM node:24-alpine AS producao
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000
CMD ["node", "dist/server.js"]
