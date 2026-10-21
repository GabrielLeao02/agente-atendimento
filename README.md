# agente-atendimento

Agente de atendimento por mensagem de texto, com IA, que permite ao cliente **consultar** e **cancelar pedidos**.

A IA interpreta a mensagem e conversa com o cliente, mas **quem decide é a API**: toda regra de negócio (quem pode ver um pedido, quando ele pode ser cancelado) é validada no código, e o agente só age por meio de ferramentas que passam por essas regras.

**Stack:** Node.js 24, TypeScript (modo estrito), Express 5, Zod, OpenAI (tool calling), pino, Vitest e Docker.

## Como rodar

O único requisito é o **Docker**. As versões de Node e de todas as dependências ficam fixadas na imagem.

```bash
docker compose up --build
```

- API: http://localhost:3000
- Swagger (documentação interativa): http://localhost:3000/docs

O build roda **typecheck e todos os testes** antes de gerar a imagem: se algum teste falhar, a imagem de produção não é criada.

### Habilitar o agente de IA

Sem chave, a API sobe normalmente e só a rota `POST /mensagens` responde `503 AGENTE_INDISPONIVEL`. Para conversar com o agente:

1. Copie o `.env.example` para `.env`
2. Preencha a `OPENAI_API_KEY` (o modelo padrão é o `gpt-5-mini`, configurável em `OPENAI_MODEL`)
3. Rode `docker compose up --build` de novo

O `.env` nunca vai para o Git nem fica gravado na imagem.

### Outros comandos

| Objetivo | Comando |
|---|---|
| Rodar os testes | `docker compose run --rm test` |
| Desenvolver com reload automático | `docker compose -f docker-compose.dev.yml watch` |
| Derrubar a API | `docker compose down` |

## Como usar

### Dados de exemplo

Os pedidos ficam em memória (reiniciar a API restaura os dados). O cliente é identificado pelo header `x-cliente-id`, que no canal real viria do número de telefone de quem envia a mensagem.

| Pedido | Cliente (`x-cliente-id`) | Status |
|---|---|---|
| 1001 | 5511999990001 | em_processamento |
| 1002 | 5511999990001 | enviado |
| 1003 | 5511999990001 | entregue |
| 1004 | 5511999990001 | cancelado |
| 1005 | 5511999990002 | em_processamento |
| 1006 | 5511999990002 | enviado |

### API principal

```bash
# Consultar
curl -H "x-cliente-id: 5511999990001" http://localhost:3000/pedidos/1001

# Solicitar cancelamento
curl -X POST -H "x-cliente-id: 5511999990001" http://localhost:3000/pedidos/1001/cancelamento
```

No PowerShell, use `curl.exe` no lugar de `curl`. Também dá para testar tudo pelo Swagger.

| Situação | HTTP | `codigo` |
|---|---|---|
| Sucesso | 200 | — |
| Entrada inválida | 400 | `DADOS_INVALIDOS` |
| Pedido não encontrado (ou de outro cliente) | 404 | `PEDIDO_NAO_ENCONTRADO` |
| Pedido não cancelável | 409 | `PEDIDO_NAO_CANCELAVEL` (com `statusAtual`) |
| Erro técnico | 500 | `ERRO_INTERNO` |
| Agente sem provedor de IA | 503 | `AGENTE_INDISPONIVEL` |

Os erros seguem sempre o formato `{ "codigo": "...", "mensagem": "..." }`.

### Conversar com o agente (mock da mensageria)

```bash
curl -X POST http://localhost:3000/mensagens \
  -H "Content-Type: application/json" \
  -H "x-cliente-id: 5511999990001" \
  -d '{"texto":"Quero cancelar o pedido 1001"}'
```

A conversa é mantida por cliente: a mensagem seguinte (por exemplo, `"Sim, pode cancelar"`) continua a mesma conversa.

## Documentação

| Documento | Conteúdo |
|---|---|
| [Regras de negócio](docs/regras.md) | Regras, dúvidas para negócio/produto, suposições e quando o agente prossegue, pede esclarecimento, recusa ou encaminha |
| [Agente de IA](docs/agente.md) | Modelo usado, função e limites da IA, prompt, ferramentas e defesas |
| [Integração com a Fake Store](docs/fake-store.md) | Como a API externa é usada e como as falhas são tratadas |
| [Casos de teste](docs/casos-de-teste.md) | Objetivo, cenário, condições e comportamento esperado de cada caso |
| [Exemplos de conversa](docs/exemplos-de-conversa.md) | Conversas reais com o agente |
| [Logs](docs/logs.md) | Eventos registrados, exemplos reais e o que nunca é logado |
| [Decisões e limitações](docs/decisoes-e-limitacoes.md) | As decisões técnicas e o porquê de cada uma, e as limitações conhecidas |

## Estrutura

```
src/
  domain/          tipos do pedido e a regra podeSerCancelado (fonte da verdade)
  repositories/    acesso aos dados (interface + implementação em memória)
  services/        regras de negócio: posse do pedido e cancelamento
  controllers/     traduzem HTTP para os services, sem regra de negócio
  routes/          rotas do Express
  schemas/         validação de entrada (Zod), também usada para gerar o Swagger
  errors/          catálogo de códigos, status e mensagens de erro
  middlewares/     tratamento central de erros
  integrations/    cliente da Fake Store API
  agent/           agente de IA: orquestrador, ferramentas, prompt e estado da conversa
    modelos/       provedores de IA (interface + OpenAI + logs)
  docs/            documento OpenAPI
tests/             62 testes automatizados (domínio, service, HTTP, agente e Fake Store)
```
