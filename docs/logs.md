# Logs

A API registra logs estruturados com o [pino](https://getpino.io): **um JSON por linha**, com campos fixos. Isso permite que ferramentas de monitoramento (Datadog, Grafana Loki, CloudWatch...) filtrem e contem eventos por campo, por exemplo "todos os `cancelamento_recusado` da última hora".

- **Produção (Docker):** JSON puro, um evento por linha.
- **Desenvolvimento:** saída legível e colorida (`pino-pretty`).
- **Testes:** silenciados, para não poluir a saída.

Para ver os logs da API rodando no Docker:

```bash
docker compose logs -f api
```

## O que nunca é logado

| Dado | Como é tratado |
|---|---|
| Texto das mensagens do cliente e das respostas do agente | Nunca é logado; registra-se só o **tamanho** |
| Telefone do cliente (`clienteId`) | Mascarado: só os 4 últimos dígitos (`***0001`) |
| Chave da API de IA e outras credenciais | Nunca são logadas |
| Detalhes internos de erros | Ficam só no log (com stack), nunca na resposta HTTP |

Como rede de segurança, a opção `redact` do pino censura automaticamente os campos `clienteId`, `apiKey` e `authorization`, se algum deles for logado por engano: eles saem como `[REMOVIDO]`.

## Eventos

| Evento | Nível | Quando | Campos principais |
|---|---|---|---|
| `servidor_iniciado` | info | A API subiu | `porta` |
| `falha_ao_iniciar` | fatal | A porta não pôde ser aberta (o processo sai com código 1) | `porta`, `err` |
| `agente_habilitado` / `agente_desabilitado` | info / warn | Na inicialização, conforme o provedor de IA configurado | `provedor`, `modelo` |
| `pedido_consultado` | info | Consulta bem-sucedida | `pedidoId`, `cliente`, `status` |
| `pedido_nao_encontrado` | info | Pedido inexistente ou de outro cliente | `operacao`, `pedidoId`, `cliente`, `motivo` (`inexistente` ou `outro_cliente`) |
| `pedido_cancelado` | info | Cancelamento concluído | `pedidoId`, `cliente` |
| `cancelamento_recusado` | info | Regra de negócio recusou o cancelamento | `pedidoId`, `cliente`, `statusAtual` |
| `requisicao_invalida` | info | Entrada inválida (400) | `metodo`, `rota`, `mensagem` |
| `erro_interno` | error | Erro inesperado (500) | `metodo`, `rota`, `err` (com stack) |
| `fake_store_consultada` | info | Produto obtido da Fake Store | `produtoId`, `duracaoMs` |
| `fake_store_falhou` | warn | Falha ao consultar a Fake Store | `produtoId`, `motivo`, `causa`, `duracaoMs` |
| `mensagem_recebida` | info | Mensagem do cliente chegou ao agente | `cliente`, `turno`, `tamanho` |
| `ia_chamada` | info | Cada chamada ao provedor de IA | `provedor`, `modelo`, `duracaoMs`, `resultado`, `ferramentas`, `tokensEntrada`, `tokensSaida`, `requestId` |
| `ia_falhou` | warn | Falha na chamada à IA | `provedor`, `modelo`, `duracaoMs`, `status`, `requestId` |
| `ferramenta_executada` | info | Cada ferramenta executada pelo agente | `ferramenta`, `cliente`, `ok`, `codigo` |
| `ferramenta_falhou` | error | Erro inesperado numa ferramenta | `ferramenta`, `err` |
| `resposta_enviada` | info | Resposta do agente enviada ao cliente | `cliente`, `turno`, `passos`, `tamanho` |
| `transferido_para_humano` | info | Cliente encaminhado ao atendimento humano | `motivo`, `cliente` |
| `agente_limite_de_passos` | warn | O modelo atingiu o limite de passos numa mensagem | `cliente`, `turno` |
| `agente_falhou` | error | Falha ao gerar a resposta do agente | `cliente`, `turno`, `err` |

O `motivo` do `pedido_nao_encontrado` é um bom exemplo do uso dos logs: o cliente recebe a mesma resposta para pedido inexistente e para pedido alheio, mas o log guarda a diferença. Assim, tentativas de acessar pedidos de outras pessoas podem ser detectadas sem revelar nada a quem tenta.

## Exemplos reais

Trechos de uma execução real no Docker com a OpenAI. Os campos `pid` e `hostname` foram removidos para facilitar a leitura.

### Inicialização

```json
{"level":"info","time":"2026-10-21T17:42:23.241Z","evento":"agente_habilitado","provedor":"openai","modelo":"gpt-5-mini","msg":"Agente de IA habilitado"}
{"level":"info","time":"2026-10-21T17:42:23.271Z","evento":"servidor_iniciado","porta":3000,"msg":"Servidor rodando em http://localhost:3000"}
```

### Cliente confirmando um cancelamento ("Sim, pode cancelar")

```json
{"level":"info","time":"2026-10-21T17:42:51.208Z","evento":"mensagem_recebida","cliente":"***0001","turno":4,"tamanho":18,"msg":"Mensagem recebida"}
{"level":"info","time":"2026-10-21T17:42:53.025Z","evento":"ia_chamada","provedor":"openai","modelo":"gpt-5-mini","mensagensEnviadas":11,"duracaoMs":1816,"resultado":"ferramentas","ferramentas":["confirmar_cancelamento"],"tokensEntrada":1670,"tokensSaida":27,"requestId":"req_7fa7a5cdb6cd4a9cba8725e8943f0cf0","msg":"Chamada à IA concluída"}
{"level":"info","time":"2026-10-21T17:42:53.038Z","evento":"pedido_cancelado","pedidoId":"1001","cliente":"***0001","msg":"Pedido cancelado"}
{"level":"info","time":"2026-10-21T17:42:53.042Z","evento":"ferramenta_executada","ferramenta":"confirmar_cancelamento","cliente":"***0001","ok":true,"msg":"Ferramenta do agente executada"}
{"level":"info","time":"2026-10-21T17:42:54.395Z","evento":"ia_chamada","provedor":"openai","modelo":"gpt-5-mini","mensagensEnviadas":13,"duracaoMs":1353,"resultado":"texto","tamanhoResposta":77,"tokensEntrada":1776,"tokensSaida":23,"requestId":"req_a2c746c162594a9986f81d27a566675e","msg":"Chamada à IA concluída"}
{"level":"info","time":"2026-10-21T17:42:54.395Z","evento":"resposta_enviada","cliente":"***0001","turno":4,"passos":2,"tamanho":77,"msg":"Resposta do agente enviada"}
```

### Cancelamento recusado pela regra de negócio (pedido enviado)

```json
{"level":"info","time":"2026-10-21T17:42:58.503Z","evento":"ferramenta_executada","ferramenta":"preparar_cancelamento","cliente":"***0001","ok":false,"codigo":"PEDIDO_NAO_CANCELAVEL","msg":"Ferramenta do agente executada"}
```

### Cliente B tentando acessar um pedido do cliente A

```json
{"level":"info","time":"2026-10-21T17:43:22.672Z","evento":"pedido_nao_encontrado","operacao":"consulta","pedidoId":"1001","cliente":"***0002","motivo":"outro_cliente","msg":"Pedido não encontrado para o cliente"}
```

### Encaminhamento para atendimento humano

```json
{"level":"info","time":"2026-10-21T17:43:19.935Z","evento":"transferido_para_humano","motivo":"fora_do_escopo","cliente":"***0001","msg":"Cliente encaminhado para atendimento humano"}
```

### Consulta à Fake Store

```json
{"level":"info","time":"2026-10-21T17:43:33.125Z","evento":"fake_store_consultada","produtoId":2,"duracaoMs":912,"msg":"Produto obtido da Fake Store"}
```

### Requisição inválida

```json
{"level":"info","time":"2026-10-21T14:55:23.730Z","evento":"requisicao_invalida","metodo":"GET","rota":"/pedidos/abc","mensagem":"O número do pedido deve conter apenas dígitos.","msg":"Requisição com dados inválidos"}
```

### Redact em ação

Um log que, por engano, incluísse dados sensíveis sairia assim:

```json
{"level":"info","evento":"teste","clienteId":"[REMOVIDO]","pedido":{"clienteId":"[REMOVIDO]"},"apiKey":"[REMOVIDO]","msg":"teste de redact"}
```
