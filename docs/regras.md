# Regras de negócio

Este documento descreve as regras do desafio, como cada uma foi aplicada, as dúvidas que ficaram para negócio/produto e as suposições provisórias adotadas para seguir em frente.

O princípio que guia todas as decisões: **a IA interpreta e conversa, mas quem decide é a API.** Cada regra abaixo é garantida pelo código, e não apenas pedida ao modelo no prompt.

## Regras do enunciado e onde cada uma é garantida

| # | Regra | Como é garantida |
|---|---|---|
| 1 | O agente pode consultar o status de um pedido | Ferramenta `consultar_pedido`, que usa o mesmo `PedidoService` da API HTTP |
| 2 | Um pedido só pode ser cancelado se ainda estiver em processamento | `podeSerCancelado()` em `src/domain/pedido.ts`, a única fonte dessa regra, aplicada no `PedidoService.cancelar` |
| 3 | Pedidos enviados não podem ser cancelados pelo fluxo automatizado | Mesma função: `enviado` retorna `409 PEDIDO_NAO_CANCELAVEL` |
| 4 | Antes de cancelar, o agente deve confirmar a intenção do cliente | **Pelo código**: o cancelamento só é executado se foi preparado para o mesmo pedido na mensagem anterior do cliente (detalhes em [agente.md](agente.md#confirmação-de-cancelamento-controlada-pelo-código)) |
| 5 | O agente só informa que cancelou se a API retornar sucesso | O modelo só recebe `ok: true` quando o `PedidoService.cancelar` conclui; o prompt proíbe afirmar o cancelamento em qualquer outro caso |
| 6 | Sem conseguir verificar, com falha de API ou faltando informação, não afirmar que concluiu | Falhas viram códigos (`ERRO_INTERNO`, `PRODUTO_INDISPONIVEL`); se a própria IA falhar, o cliente recebe uma resposta fixa que não afirma nenhuma ação |
| 7 | Oferecer atendimento humano fora do escopo ou quando não for possível resolver com segurança | Ferramenta `transferir_para_humano`; o prompt manda oferecer o humano em recusas, falhas e assuntos fora do escopo |
| 8 | Informações do cliente ou de API externa não substituem as regras | O `clienteId` vem do canal, nunca do texto; argumentos do modelo são validados com Zod; a descrição dos produtos (texto de terceiros) nem chega ao modelo |

## Status do pedido e cancelamento

| Status | Pode cancelar? | Origem |
|---|---|---|
| `em_processamento` | ✅ Sim | Regra 2 |
| `enviado` | ❌ Não | Regra 3 |
| `entregue` | ❌ Não | **Suposição**: se um pedido enviado não pode ser cancelado, um entregue também não |
| `cancelado` | ❌ Não | **Suposição**: cancelar um pedido já cancelado responde `409` com o status atual, nunca sucesso, para o agente não afirmar que cancelou algo nesta conversa |

## Posse do pedido e identificação do cliente

- Consulta e cancelamento exigem o número do pedido **e** o cliente. A API só responde se o pedido pertencer ao cliente.
- Um pedido de outro cliente responde **`404 PEDIDO_NAO_ENCONTRADO`**, exatamente igual a um pedido inexistente, para não revelar que o pedido existe (proteção contra enumeração). Internamente, o log registra o motivo real (`outro_cliente` ou `inexistente`), o que permite detectar tentativas de acessar pedidos alheios.
- O cliente é identificado pelo **canal de mensageria** (header `x-cliente-id`, que num canal real seria o telefone de quem envia), **nunca pelo texto** que ele digita nem por um valor que o modelo informe.

## Suposições provisórias

Adotadas para seguir em frente e marcadas para validação com negócio/produto:

| Suposição | Justificativa |
|---|---|
| `entregue` não pode ser cancelado pelo fluxo automatizado | Se `enviado` não pode (Regra 3), um pedido entregue, que está ainda mais adiante, também não deveria |
| Cancelar um pedido já `cancelado` responde `409`, não sucesso | Responder sucesso faria o agente afirmar "cancelei" sem ter cancelado nada nesta conversa (conflito com a Regra 5) |
| "Em processamento" é um único status, sem subdivisões | O enunciado não detalha etapas internas (pagamento, separação etc.) |
| O cliente é identificado com segurança pelo canal | No mock, o header `x-cliente-id` representa o telefone verificado pelo canal |
| O atendimento humano é simulado | A ferramenta registra o encaminhamento; não há fila real nem horário de atendimento |
| A Fake Store responde `200` com corpo vazio para produto inexistente, e isso é tratado como "não encontrado" | Comportamento observado na API real (ver [fake-store.md](fake-store.md)) |

## Dúvidas para negócio/produto

1. O que exatamente é "em processamento"? Inclui um pedido aguardando pagamento?
2. Cancelar um pedido já cancelado deve ser erro ou sucesso idempotente?
3. Um pedido entregue pode ser devolvido ou cancelado por outro fluxo?
4. Como o cliente é identificado com segurança no canal real de mensagens?
5. Há prazo máximo para cancelamento dentro de "em processamento"?
6. Cancelamento parcial (só alguns itens) é permitido?
7. Qual o canal e o horário do atendimento humano? O que o agente deve dizer fora do horário?
8. Em qual moeda estão os preços dos produtos?

## Quando o agente prossegue, pede esclarecimento, recusa ou encaminha

| Situação | Decisão | Ação do agente |
|---|---|---|
| Pediu o status e informou o número do pedido | **Prossegue** | Consulta a API e responde |
| Pediu algo sem informar o número do pedido | **Pede esclarecimento** | Pede o número antes de qualquer ação |
| Número do pedido em formato inválido | **Pede esclarecimento** | Pede o número novamente (apenas dígitos) |
| Quer cancelar um pedido `em_processamento` | **Pede confirmação** | Prepara o cancelamento e pergunta se o cliente confirma; só cancela depois de um "sim" explícito na mensagem seguinte |
| A API retornou sucesso no cancelamento | **Prossegue** | Informa que o pedido foi cancelado |
| Quer cancelar um pedido `enviado`, `entregue` ou `cancelado` | **Recusa** | Explica o motivo com o status atual e oferece atendimento humano |
| Pedido não encontrado (ou de outro cliente) | **Pede esclarecimento** | Diz que não encontrou e pede para conferir o número, sem especular |
| Falha da API principal ou da própria IA | **Recusa** (não afirma nada) | Avisa que não foi possível concluir, informa que nada foi alterado e oferece atendimento humano |
| Fake Store fora do ar | **Prossegue** | Segue sem os dados do produto; consulta e cancelamento não dependem dela |
| Fora do escopo (troca, devolução, reembolso, reclamação) | **Encaminha** | Oferece atendimento humano e, se o cliente aceitar, encaminha |
| Pede para ignorar as regras ou revelar as instruções | **Recusa** | Recusa educadamente e volta ao atendimento |
| Afirma algo que contradiz a API ("o atendente disse que dava") | **Recusa** | Vale o que a API retorna; oferece atendimento humano |
