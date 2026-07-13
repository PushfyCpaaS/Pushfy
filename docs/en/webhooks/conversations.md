# Conversations webhook

Receive **PushAgent** (Conversational AI) events as HTTP `POST`s to your own URL — a
conversation starts, a message is exchanged, an intent is detected, a handoff is requested.

- **Direction** — Pushfy → your endpoint (`https://your-app.com/webhook`)
- **Method** — `POST`
- **Signature** — `X-PA-Signature: <hex>`, where `<hex> = HMAC-SHA256(raw_body, WEBHOOK_SECRET)`
- **Content-Type** — `application/json`

> **⚠️ Raw hex signature.** Unlike the Messaging and Push webhooks, the PushAgent signature is the
> **raw hex digest only** — there is **no `sha256=` prefix**. Compare against the bare hex.

## Events

| Event | When it fires |
|---|---|
| `conversation.started` | A new conversation began |
| `message.received` | An inbound message from the user |
| `message.sent` | The bot sent a reply |
| `intent.detected` | The agent classified the user's intent |
| `sentiment.critical` | Sentiment crossed a critical threshold |
| `handoff.requested` | The conversation should be handed to a human |
| `conversation.resolved` | The conversation was closed/resolved |
| `task.completed` | A configured task finished |

## Headers

```
X-PA-Event:     handoff.requested     # the event name
X-PA-Delivery:  evt_8a1f...           # the eid — use it for idempotency
X-PA-Signature: <hex>                 # HMAC-SHA256(raw_body, secret) — RAW HEX, no prefix
Content-Type:   application/json
```

## Payload

Every event uses the same envelope:

```json
{
  "eid": "evt_8a1f4c90d2e7",
  "event": "handoff.requested",
  "sent_at": "2026-07-12T13:50:00-03:00",
  "data": {
    "conversation_id": 8842,
    "intent": "suporte_saque",
    "motivo": "cliente pediu humano"
  }
}
```

| Field | Type | Description |
|---|---|---|
| `eid` | string | Unique delivery id (`evt_…`). Also in `X-PA-Delivery`. Deduplicate by this |
| `event` | string | Event name (matches `X-PA-Event`) |
| `sent_at` | string | ISO-8601 timestamp with timezone |
| `data` | object | Event-specific fields |

### Example payloads

**`message.sent`** (the bot's reply)

```json
{
  "eid": "evt_11c9d7f00a34",
  "event": "message.sent",
  "sent_at": "2026-07-12T13:49:05-03:00",
  "data": {
    "conversation_id": 8842,
    "text": "Seu saque foi solicitado e cai em até 30 minutos.",
    "intent": "suporte_saque"
  }
}
```

**`handoff.requested`**

```json
{
  "eid": "evt_8a1f4c90d2e7",
  "event": "handoff.requested",
  "sent_at": "2026-07-12T13:50:00-03:00",
  "data": {
    "conversation_id": 8842,
    "intent": "suporte_saque",
    "motivo": "cliente pediu humano"
  }
}
```

**`conversation.resolved`**

```json
{
  "eid": "evt_f3b2a7c81905",
  "event": "conversation.resolved",
  "sent_at": "2026-07-12T13:58:30-03:00",
  "data": {
    "conversation_id": 8842,
    "resolution": "resolved_by_bot"
  }
}
```

## Validating the signature

Compute the HMAC over the **raw body** and compare against the header — **raw hex, no prefix** —
in constant time:

```python
import hashlib, hmac

def valid(raw_body: bytes, header: str, secret: str) -> bool:
    expected = hmac.new(
        secret.encode(), raw_body, hashlib.sha256
    ).hexdigest()                 # no "sha256=" prefix
    return hmac.compare_digest(expected, header or "")

# header = request.headers["X-PA-Signature"]
# secret = WEBHOOK_SECRET
```

Then deduplicate by `eid` (`X-PA-Delivery`) before acting on the event.

## Notes

- **Respond `2xx` fast**, process asynchronously. Timeout is ~12 s.
- **Retries** — up to 6 attempts with backoff `[immediate, 1 min, 5 min, 15 min, 1 h, 3 h]`.
- **`handoff.requested`** is your cue to route the conversation to a human agent; `motivo` explains
  why the agent escalated.

## Next steps

- [Webhooks overview](./README.md)
- [Authentication](../reference/authentication.md)
