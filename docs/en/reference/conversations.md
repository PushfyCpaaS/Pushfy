# Conversational AI (PushAgent)

Run AI-powered conversations over the API. You open a conversation, post user messages, and the
PushAgent bot replies. When the bot can't help, hand off to a human agent; when you're done, close
the conversation.

- **Base URL** — `https://portal.pushfy.com/v2/api.php?r=<route>`
- **Auth** — HMAC (`X-PA-Key` / `X-PA-Timestamp` / `X-PA-Signature`) — see [Authentication](./authentication.md) for the signing recipe.
- **Content-Type** — `application/json`

## How it works

A conversation moves through three states:

| `status` | Meaning |
|---|---|
| `bot` | The AI agent is handling the conversation and answers automatically |
| `humano` | Handed off to a human agent — the bot no longer replies |
| `fechada` | Closed — no further replies |

**Bot replies are asynchronous.** When you post a user message and the conversation is in the `bot`
state, the API accepts the message immediately and the AI answers a moment later. You get the reply
by either:

- polling [`GET /v1/conversations/{id}`](#get-a-conversation) and reading the newest `messages`, or
- subscribing to the `message.sent` [conversation webhook](../webhooks/conversations.md) (recommended).

## Typical flow

1. **Open** a conversation with your own user id → `POST /v1/conversations` → get `conversation_id`.
2. **Send** the user's message → `POST /v1/conversations/{id}/messages`.
3. **Read the bot reply** → poll `GET /v1/conversations/{id}` or wait for the `message.sent` webhook.
4. Optionally **hand off** to a human, **close** the conversation, send **events** for context, or
   schedule a follow-up **task**.

## Signing

Every request is signed with HMAC-SHA256. The `path` used in the signature is the route only
(e.g. `/v1/conversations`), without the `?r=` query string. See [Authentication → Signing recipe](./authentication.md#signing-recipe).
In the examples below, `X-PA-Signature: ...` is the signature produced by that recipe.

---

## Open a conversation

`POST /v1/conversations`

### Body

| Field | Type | Required | Description |
|---|---|---|---|
| `user_ext_id` | string | ✅ | Your own id for the end user (external id) |
| `name` | string | — | Display name for the user |
| `channel` | string | — | One of `webchat`, `sms`, `rcs`, `api`. Default `api` |

### Request

```bash
curl -X POST 'https://portal.pushfy.com/v2/api.php?r=/v1/conversations' \
  -H 'X-PA-Key: pak_xxxxxxxxxxxxxxxxxxxx' \
  -H 'X-PA-Timestamp: 1752330000' \
  -H 'X-PA-Signature: ...' \
  -H 'Content-Type: application/json' \
  -d '{ "user_ext_id": "user-42", "name": "Ana", "channel": "api" }'
```

### Response

`200 OK`

```json
{ "ok": true, "conversation_id": 123, "status": "bot" }
```

### Errors

| HTTP | Body | Cause |
|---|---|---|
| 400 | `{"ok":false,"error":"user_ext_id"}` | `user_ext_id` missing |

---

## Get a conversation

`GET /v1/conversations/{id}`

Returns the conversation state and up to the **200 most recent messages**. Poll this to read the
bot's asynchronous replies.

### Response

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
    { "role": "user", "content": "How do I withdraw?", "created_at": "2026-07-12 14:33:21" },
    { "role": "assistant", "content": "You can withdraw from Wallet → Withdraw…", "created_at": "2026-07-12 14:33:24" }
  ]
}
```

### Request

```bash
curl 'https://portal.pushfy.com/v2/api.php?r=/v1/conversations/123' \
  -H 'X-PA-Key: pak_xxxxxxxxxxxxxxxxxxxx' \
  -H 'X-PA-Timestamp: 1752330000' \
  -H 'X-PA-Signature: ...'
```

> For a GET with an empty body, the signature body hash is `sha256_hex("")` — see the recipe.

### Errors

| HTTP | Body | Cause |
|---|---|---|
| 404 | `{"error":"conversa"}` | No such conversation on your account |

---

## Send a message

`POST /v1/conversations/{id}/messages`

Posts a message **from the user**. If the conversation is in the `bot` state, the AI replies
**asynchronously** — read it via `GET` or the `message.sent` webhook.

### Body

| Field | Type | Required | Description |
|---|---|---|---|
| `content` | string | ✅ | The user's message text (`text` is accepted as an alias) |

### Request

```bash
curl -X POST 'https://portal.pushfy.com/v2/api.php?r=/v1/conversations/123/messages' \
  -H 'X-PA-Key: pak_xxxxxxxxxxxxxxxxxxxx' \
  -H 'X-PA-Timestamp: 1752330000' \
  -H 'X-PA-Signature: ...' \
  -H 'Content-Type: application/json' \
  -d '{ "content": "How do I withdraw my balance?" }'
```

### Response

`200 OK`

```json
{ "ok": true, "message_id": 9876, "status": "bot" }
```

### Errors

| HTTP | Body | Cause |
|---|---|---|
| 400 | `{"error":"content"}` | Empty message |
| 404 | `{"error":"conversa"}` | No such conversation on your account |

---

## Hand off to a human

`POST /v1/conversations/{id}/handoff`

Transfers the conversation to a human agent. The bot stops replying (`status` becomes `humano`).

### Request

```bash
curl -X POST 'https://portal.pushfy.com/v2/api.php?r=/v1/conversations/123/handoff' \
  -H 'X-PA-Key: pak_xxxxxxxxxxxxxxxxxxxx' \
  -H 'X-PA-Timestamp: 1752330000' \
  -H 'X-PA-Signature: ...'
```

### Response

```json
{ "ok": true }
```

### Errors

| HTTP | Body | Cause |
|---|---|---|
| 404 | `{"error":"conversa"}` | No such conversation on your account |

---

## Close a conversation

`POST /v1/conversations/{id}/close`

Ends the conversation (`status` becomes `fechada`). No further replies.

### Request

```bash
curl -X POST 'https://portal.pushfy.com/v2/api.php?r=/v1/conversations/123/close' \
  -H 'X-PA-Key: pak_xxxxxxxxxxxxxxxxxxxx' \
  -H 'X-PA-Timestamp: 1752330000' \
  -H 'X-PA-Signature: ...'
```

### Response

```json
{ "ok": true }
```

### Errors

| HTTP | Body | Cause |
|---|---|---|
| 404 | `{"error":"conversa"}` | No such conversation on your account |

---

## Send a business event

`POST /v1/events`

Push a business event to give the agent context and enable proactive behavior (e.g. a deposit
completed, a support ticket opened). Events are tied to a user by `user_ext_id`.

### Body

| Field | Type | Required | Description |
|---|---|---|---|
| `type` | string | ✅ | Event type, up to 48 characters (e.g. `deposit_completed`) |
| `user_ext_id` | string | — | Your id for the user the event belongs to |
| `data` | object | — | Arbitrary key/value payload for the event |

### Request

```bash
curl -X POST 'https://portal.pushfy.com/v2/api.php?r=/v1/events' \
  -H 'X-PA-Key: pak_xxxxxxxxxxxxxxxxxxxx' \
  -H 'X-PA-Timestamp: 1752330000' \
  -H 'X-PA-Signature: ...' \
  -H 'Content-Type: application/json' \
  -d '{ "type": "deposit_completed", "user_ext_id": "user-42", "data": { "amount": 50.0, "currency": "BRL" } }'
```

### Response

```json
{ "ok": true }
```

### Errors

| HTTP | Body | Cause |
|---|---|---|
| 400 | `{"error":"type"}` | `type` missing or empty |

---

## Schedule a follow-up task

`POST /v1/tasks`

Schedules a follow-up on an existing conversation — for example, to re-engage the user later.

### Body

| Field | Type | Required | Description |
|---|---|---|---|
| `conversation_id` | int | ✅ | A conversation on your account |
| `run_at` | string | ✅ | When to run — a future date/time |
| `text` | string | — | Note / message for the follow-up |

### Request

```bash
curl -X POST 'https://portal.pushfy.com/v2/api.php?r=/v1/tasks' \
  -H 'X-PA-Key: pak_xxxxxxxxxxxxxxxxxxxx' \
  -H 'X-PA-Timestamp: 1752330000' \
  -H 'X-PA-Signature: ...' \
  -H 'Content-Type: application/json' \
  -d '{ "conversation_id": 123, "run_at": "2026-07-13 10:00:00", "text": "Check if the withdrawal went through" }'
```

### Response

```json
{ "ok": true, "task_id": 55 }
```

### Errors

| HTTP | Body | Cause |
|---|---|---|
| 404 | `{"error":"conversa"}` | `conversation_id` not on your account |
| 400 | `{"error":"run_at"}` | `run_at` missing or in the past |

---

## General errors

These apply to every route above.

| HTTP | Body | Meaning |
|---|---|---|
| 401 | `unauthorized` | Missing header, bad signature, or timestamp outside the 300s window |
| 403 | `produto_inativo` | PushAgent isn't enabled on your account |
| 404 | `rota_desconhecida` | Unknown route |
| 429 | `rate_limited` | Too many requests — 300 per 60s, per IP and per account |
| 500 | `internal` | Temporary server error — safe to retry |

## Next steps

- [Conversation webhooks](../webhooks/conversations.md) — receive `message.sent` and state changes in real time instead of polling.
