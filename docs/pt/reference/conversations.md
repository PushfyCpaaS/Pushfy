# IA Conversacional (PushAgent)

Conduza conversas com IA pela API. Você abre uma conversa, envia mensagens do usuário e o bot do
PushAgent responde. Quando o bot não consegue ajudar, transfira para um atendente humano; ao
terminar, encerre a conversa.

- **Base URL** — `https://portal.pushfy.com/v2/api.php?r=<rota>`
- **Auth** — HMAC (`X-PA-Key` / `X-PA-Timestamp` / `X-PA-Signature`) — veja [Autenticação](./authentication.md) para a receita de assinatura.
- **Content-Type** — `application/json`

## Como funciona

Uma conversa passa por três estados:

| `status` | Significado |
|---|---|
| `bot` | O agente de IA está conduzindo a conversa e responde automaticamente |
| `humano` | Transferida para um atendente humano — o bot não responde mais |
| `fechada` | Encerrada — sem novas respostas |

**As respostas do bot são assíncronas.** Quando você envia uma mensagem do usuário e a conversa
está no estado `bot`, a API aceita a mensagem imediatamente e a IA responde instantes depois. Você
obtém a resposta de uma das formas:

- consultando [`GET /v1/conversations/{id}`](#obter-uma-conversa) e lendo as mensagens mais recentes, ou
- assinando o webhook `message.sent` de [conversas](../webhooks/conversations.md) (recomendado).

## Fluxo típico

1. **Abra** uma conversa com o seu id de usuário → `POST /v1/conversations` → obtenha o `conversation_id`.
2. **Envie** a mensagem do usuário → `POST /v1/conversations/{id}/messages`.
3. **Leia a resposta do bot** → consulte `GET /v1/conversations/{id}` ou aguarde o webhook `message.sent`.
4. Opcionalmente **transfira** para um humano, **encerre** a conversa, envie **eventos** de contexto ou
   agende uma **tarefa** de follow-up.

## Assinatura

Toda requisição é assinada com HMAC-SHA256. O `path` usado na assinatura é apenas a rota
(ex.: `/v1/conversations`), sem a query string `?r=`. Veja [Autenticação → Receita de assinatura](./authentication.md#signing-recipe).
Nos exemplos abaixo, `X-PA-Signature: ...` é a assinatura produzida por essa receita.

---

## Abrir uma conversa

`POST /v1/conversations`

### Body

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `user_ext_id` | string | ✅ | Seu id para o usuário final (id externo) |
| `name` | string | — | Nome de exibição do usuário |
| `channel` | string | — | Um de `webchat`, `sms`, `rcs`, `api`. Padrão `api` |

### Requisição

```bash
curl -X POST 'https://portal.pushfy.com/v2/api.php?r=/v1/conversations' \
  -H 'X-PA-Key: pak_xxxxxxxxxxxxxxxxxxxx' \
  -H 'X-PA-Timestamp: 1752330000' \
  -H 'X-PA-Signature: ...' \
  -H 'Content-Type: application/json' \
  -d '{ "user_ext_id": "user-42", "name": "Ana", "channel": "api" }'
```

### Resposta

`200 OK`

```json
{ "ok": true, "conversation_id": 123, "status": "bot" }
```

### Erros

| HTTP | Body | Causa |
|---|---|---|
| 400 | `{"ok":false,"error":"user_ext_id"}` | `user_ext_id` ausente |

---

## Obter uma conversa

`GET /v1/conversations/{id}`

Retorna o estado da conversa e até as **200 mensagens mais recentes**. Consulte este endpoint para
ler as respostas assíncronas do bot.

### Resposta

`200 OK`

```json
{
  "ok": true,
  "conversation_id": 123,
  "status": "bot",
  "canal": "api",
  "intent": "billing",
  "sentiment": "neutral",
  "messages": [
    { "role": "user", "content": "Como faço um saque?", "created_at": "2026-07-12 14:33:21" },
    { "role": "assistant", "content": "Você pode sacar em Carteira → Saque…", "created_at": "2026-07-12 14:33:24" }
  ]
}
```

### Requisição

```bash
curl 'https://portal.pushfy.com/v2/api.php?r=/v1/conversations/123' \
  -H 'X-PA-Key: pak_xxxxxxxxxxxxxxxxxxxx' \
  -H 'X-PA-Timestamp: 1752330000' \
  -H 'X-PA-Signature: ...'
```

> Para um GET com body vazio, o hash do body na assinatura é `sha256_hex("")` — veja a receita.

### Erros

| HTTP | Body | Causa |
|---|---|---|
| 404 | `{"error":"conversa"}` | Conversa inexistente na sua conta |

---

## Enviar uma mensagem

`POST /v1/conversations/{id}/messages`

Envia uma mensagem **do usuário**. Se a conversa está no estado `bot`, a IA responde de forma
**assíncrona** — leia a resposta via `GET` ou pelo webhook `message.sent`.

### Body

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `content` | string | ✅ | Texto da mensagem do usuário (`text` é aceito como alias) |

### Requisição

```bash
curl -X POST 'https://portal.pushfy.com/v2/api.php?r=/v1/conversations/123/messages' \
  -H 'X-PA-Key: pak_xxxxxxxxxxxxxxxxxxxx' \
  -H 'X-PA-Timestamp: 1752330000' \
  -H 'X-PA-Signature: ...' \
  -H 'Content-Type: application/json' \
  -d '{ "content": "Como faço para sacar meu saldo?" }'
```

### Resposta

`200 OK`

```json
{ "ok": true, "message_id": 9876, "status": "bot" }
```

### Erros

| HTTP | Body | Causa |
|---|---|---|
| 400 | `{"error":"content"}` | Mensagem vazia |
| 404 | `{"error":"conversa"}` | Conversa inexistente na sua conta |

---

## Transferir para um humano

`POST /v1/conversations/{id}/handoff`

Transfere a conversa para um atendente humano. O bot para de responder (`status` passa a `humano`).

### Requisição

```bash
curl -X POST 'https://portal.pushfy.com/v2/api.php?r=/v1/conversations/123/handoff' \
  -H 'X-PA-Key: pak_xxxxxxxxxxxxxxxxxxxx' \
  -H 'X-PA-Timestamp: 1752330000' \
  -H 'X-PA-Signature: ...'
```

### Resposta

```json
{ "ok": true }
```

### Erros

| HTTP | Body | Causa |
|---|---|---|
| 404 | `{"error":"conversa"}` | Conversa inexistente na sua conta |

---

## Encerrar uma conversa

`POST /v1/conversations/{id}/close`

Encerra a conversa (`status` passa a `fechada`). Sem novas respostas.

### Requisição

```bash
curl -X POST 'https://portal.pushfy.com/v2/api.php?r=/v1/conversations/123/close' \
  -H 'X-PA-Key: pak_xxxxxxxxxxxxxxxxxxxx' \
  -H 'X-PA-Timestamp: 1752330000' \
  -H 'X-PA-Signature: ...'
```

### Resposta

```json
{ "ok": true }
```

### Erros

| HTTP | Body | Causa |
|---|---|---|
| 404 | `{"error":"conversa"}` | Conversa inexistente na sua conta |

---

## Enviar um evento de negócio

`POST /v1/events`

Envie um evento de negócio para dar contexto ao agente e habilitar proatividade (ex.: um depósito
concluído, um ticket de suporte aberto). Os eventos são associados a um usuário por `user_ext_id`.

### Body

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `type` | string | ✅ | Tipo do evento, até 48 caracteres (ex.: `deposit_completed`) |
| `user_ext_id` | string | — | Seu id para o usuário a quem o evento pertence |
| `data` | object | — | Payload livre de chave/valor do evento |

### Requisição

```bash
curl -X POST 'https://portal.pushfy.com/v2/api.php?r=/v1/events' \
  -H 'X-PA-Key: pak_xxxxxxxxxxxxxxxxxxxx' \
  -H 'X-PA-Timestamp: 1752330000' \
  -H 'X-PA-Signature: ...' \
  -H 'Content-Type: application/json' \
  -d '{ "type": "deposit_completed", "user_ext_id": "user-42", "data": { "amount": 50.0, "currency": "BRL" } }'
```

### Resposta

```json
{ "ok": true }
```

### Erros

| HTTP | Body | Causa |
|---|---|---|
| 400 | `{"error":"type"}` | `type` ausente ou vazio |

---

## Agendar uma tarefa de follow-up

`POST /v1/tasks`

Agenda um follow-up sobre uma conversa existente — por exemplo, para reengajar o usuário depois.

### Body

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `conversation_id` | int | ✅ | Uma conversa da sua conta |
| `run_at` | string | ✅ | Quando executar — uma data/hora futura |
| `text` | string | — | Nota / mensagem do follow-up |

### Requisição

```bash
curl -X POST 'https://portal.pushfy.com/v2/api.php?r=/v1/tasks' \
  -H 'X-PA-Key: pak_xxxxxxxxxxxxxxxxxxxx' \
  -H 'X-PA-Timestamp: 1752330000' \
  -H 'X-PA-Signature: ...' \
  -H 'Content-Type: application/json' \
  -d '{ "conversation_id": 123, "run_at": "2026-07-13 10:00:00", "text": "Verificar se o saque foi concluído" }'
```

### Resposta

```json
{ "ok": true, "task_id": 55 }
```

### Erros

| HTTP | Body | Causa |
|---|---|---|
| 404 | `{"error":"conversa"}` | `conversation_id` não pertence à sua conta |
| 400 | `{"error":"run_at"}` | `run_at` ausente ou no passado |

---

## Erros gerais

Aplicam-se a todas as rotas acima.

| HTTP | Body | Significado |
|---|---|---|
| 401 | `unauthorized` | Header ausente, assinatura inválida ou timestamp fora da janela de 300s |
| 403 | `produto_inativo` | PushAgent não está habilitado na sua conta |
| 404 | `rota_desconhecida` | Rota desconhecida |
| 429 | `rate_limited` | Requisições em excesso — 300 a cada 60s, por IP e por conta |
| 500 | `internal` | Erro temporário do servidor — seguro repetir |

## Próximos passos

- [Webhooks de conversas](../webhooks/conversations.md) — receba `message.sent` e mudanças de estado em tempo real, sem precisar consultar por polling.
