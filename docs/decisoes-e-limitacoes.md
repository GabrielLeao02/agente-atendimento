# Decisões e limitações

## Decisões técnicas

### Arquitetura

| Decisão | Por quê |
|---|---|
| **Camadas**: rotas → controllers → services → repositórios | Cada camada tem uma responsabilidade. Os controllers só traduzem HTTP; as regras ficam nos services; o acesso a dados fica nos repositórios |
| **Regra de cancelamento numa única função** (`podeSerCancelado`) | Uma só fonte da verdade. A API HTTP e o agente usam o mesmo `PedidoService`, então não existe uma regra "do agente" diferente da regra "da API" |
| **Repositório como interface**, com implementação em memória | O enunciado permite dados em memória. A interface permite trocar por um banco sem mexer nos services, e facilita os testes |
| **Injeção de dependência pelo construtor**, montada em `criarApp()` | Cada camada recebe a de baixo. Nos testes, cada um recebe um app novo, com dados próprios, e dá para injetar falhas (ex.: um repositório quebrado para testar o `500`) |
| **Repositório devolve cópias** (`structuredClone`) | Quem recebe um pedido não consegue alterar os dados guardados sem passar pelas regras |

### API

| Decisão | Por quê |
|---|---|
| **Cliente identificado por header** (`x-cliente-id`) | Representa o telefone que o canal de mensageria entregaria. O cliente nunca se identifica pelo texto (Regra 8) |
| **Pedido de outro cliente responde 404**, igual a inexistente | Não revela que o pedido existe, o que evita enumeração. O log guarda o motivo real |
| **Códigos de erro estáveis** (`{ codigo, mensagem }`) | O agente decide o que dizer pelo `codigo`, não pelo texto. Os códigos, status e mensagens ficam num catálogo único (`src/errors/catalogo-erros.ts`): trocar o idioma é editar um arquivo, e um código digitado errado não compila |
| **Cancelar pedido já cancelado responde 409**, não sucesso | Responder sucesso faria o agente afirmar um cancelamento que não aconteceu nesta conversa |
| **Validação com Zod** | Valida a entrada e gera os tipos TypeScript. Os mesmos schemas geram o Swagger, então validação e documentação não ficam desalinhadas |
| **Tratamento de erros centralizado** | Um único middleware transforma qualquer erro em resposta. Os controllers não têm `try/catch` (o Express 5 encaminha erros de rotas `async`). Erros inesperados viram `500` sem detalhes internos |
| **JSON malformado responde 400** | O problema é de quem enviou, não do servidor |

### Agente de IA

| Decisão | Por quê |
|---|---|
| **Tool calling**: o modelo pede, o código executa | A IA nunca acessa ou altera dados diretamente. Toda ação passa por uma ferramenta que valida os argumentos e chama as regras da API |
| **Confirmação de cancelamento controlada pelo código** | Pedir a confirmação só no prompt não garante nada. Duas ferramentas (preparar e confirmar) e um estado de conversa garantem que existiu uma pergunta e uma resposta do cliente antes de cancelar |
| **`clienteId` vem do canal**, nunca do modelo | Um modelo induzido por prompt injection não consegue agir em nome de outro cliente |
| **Status e datas formatados pelo código** | Formatar `18/10/2026` ou `em processamento` é determinístico. Deixar isso para o modelo gerou erros nos testes reais (ex.: "em_processing") |
| **Resposta segura e fixa em caso de falha** | Se a IA falhar ou entrar em loop, o cliente recebe uma mensagem que não afirma nenhuma ação (Regra 6) |
| **Provedores de IA atrás de uma interface** (`ModeloIA`) | Mesmo padrão dos repositórios: trocar de IA é criar uma implementação, sem mexer no agente. Nos testes, um modelo simulado implementa a mesma interface |
| **Logs da IA num decorator** (`ModeloComLog`) | Todo provedor novo já nasce com logs de duração, tokens e request id, sem repetir código |
| **Modelo `gpt-5-mini`** | Tool calling nativo, custo baixo e latência adequada para conversa de texto |
| **Sem chave de IA, a API sobe mesmo assim** | Consulta, cancelamento e Swagger funcionam sem a OpenAI; só `/mensagens` responde `503` |

### Fake Store

| Decisão | Por quê |
|---|---|
| **A API de pedidos não depende da Fake Store** | Se ela cair, consulta e cancelamento continuam funcionando. Quem combina pedido e produto é o agente |
| **Resultado explícito** (`ok` / `reason`) em vez de exceções | Obriga quem chama a tratar a falha |
| **Timeout de 3 s e validação com Zod** | Uma API de terceiros lenta ou com resposta inesperada não trava nem corrompe o atendimento |
| **Descrição do produto descartada** | É texto livre de terceiros e poderia conter prompt injection |

### Infraestrutura

| Decisão | Por quê |
|---|---|
| **Tudo no container** (produção, testes e desenvolvimento) | Quem clonar o projeto só precisa do Docker; as versões ficam fixadas na imagem |
| **Testes rodam no build da imagem** | Uma imagem de produção com teste falhando nem chega a existir |
| **Imagem de produção enxuta**, com usuário sem privilégios | Só `dist/` e dependências de produção; sem Vitest, TypeScript ou tsx; roda como usuário `node`, não como root |
| **Desenvolvimento com `docker compose watch`** | No Windows, pastas montadas não avisam o container sobre alterações. O `watch` sincroniza cada arquivo salvo e a API reinicia sozinha |
| **Logs estruturados com pino** | JSON por linha para ferramentas de monitoramento; dados pessoais mascarados ou omitidos |

## Limitações conhecidas

### Dados e estado

- **Dados em memória:** reiniciar a API restaura os pedidos de exemplo e apaga as conversas. Com um banco, bastaria uma nova implementação de `PedidoRepository`.
- **Conversas em memória e sem expiração:** o histórico de cada cliente fica no processo, limitado às últimas 40 mensagens. Com várias instâncias da API, seria preciso guardar as conversas fora do processo (ex.: Redis).
- **Concorrência no cancelamento:** entre buscar o pedido e atualizar o status há um pequeno intervalo. Duas requisições simultâneas para o mesmo pedido poderiam passar pela regra ao mesmo tempo. Em memória, o resultado final é o mesmo (`cancelado`). Com banco, a solução seria um update condicional (`UPDATE ... WHERE status = 'em_processamento'`).
- **Mensagens simultâneas do mesmo cliente** não passam por uma fila e poderiam ser processadas em paralelo.

### Agente

- **O texto das respostas varia:** o modelo segue as instruções, mas a redação muda entre execuções. As regras críticas (confirmação, posse, cancelamento) não dependem do texto, e sim do código.
- **Interpretação do "sim":** o código garante que existiu uma pergunta e uma resposta do cliente antes de cancelar, mas quem interpreta se a resposta é uma confirmação é o modelo.
- **Latência:** cada mensagem leva de 3 a 15 segundos, quase tudo nas chamadas à IA (cada mensagem pode exigir de 1 a 3 chamadas).
- **Atendimento humano simulado:** a ferramenta registra o encaminhamento, mas não há fila real, horário de atendimento nem protocolo.
- **Sem detecção automática de idioma:** o agente responde sempre em português.

### Integrações

- **Mensageria simulada:** `POST /mensagens` representa o webhook de um canal como o WhatsApp. Não há assinatura do webhook nem verificação real do telefone; o header `x-cliente-id` é confiado como vindo do canal.
- **Fake Store:** os preços não têm moeda definida, e nomes e categorias vêm em inglês. Produto inexistente é detectado pelo corpo vazio, um comportamento observado, não documentado pela API.

### Segurança e operação

- **Sem autenticação na API principal:** a API confia no header do cliente, como num ambiente interno atrás do canal de mensageria. Exposta publicamente, precisaria de autenticação entre o canal e a API.
- **Sem limite de requisições** (rate limiting) por cliente.
- **Defesa contra prompt injection em camadas, mas não absoluta:** o prompt orienta o modelo a recusar, e as ações críticas não dependem dele. Ainda assim, o modelo poderia ser induzido a dizer algo fora do tom esperado.
