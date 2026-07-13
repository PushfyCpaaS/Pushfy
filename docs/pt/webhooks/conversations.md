# Webhook de Conversas

Receba eventos do **PushAgent** (IA Conversacional) como `POST` HTTP na sua própria URL — uma
conversa começa, uma mensagem é trocada, uma intenção é detectada, uma transferência é pedida.

- **Direção** — Pushfy → seu endpoint (`https://your-app.com/webhook`)
- **Método** — `POST`
- **Assinatura** — `X-PA-Signature: <hex>`, em que `<hex> = HMAC-SHA256(corpo_bruto, WEBHOOK_SECRET)`
- **Content-Type** — `application/json`

> **⚠️ Assinatura em hex puro.** Diferente dos webhooks de Mensageria e Push, a assinatura do
> PushAgent é **apenas o digest em hex puro** — **sem o prefixo `sha256=`**. Compare contra o hex
> cru.

## Eventos

| Evento | Quando dispara |
|---|---|
| `conversation.started` | Uma nova conversa começou |
| `message.received` | Uma mensagem recebida do usuário |
| `message.sent` | O bot enviou uma resposta |
| `intent.detected` | O agente classificou a intenção do usuário |
| `sentiment.critical` | O sentimento cruzou um limiar crítico |
| `handoff.requested` | A conversa deve ser transferida para um humano |
| `conversation.resolved` | A conversa foi encerrada/resolvida |
| `task.completed` | Uma tarefa configurada terminou |

## Cabeçalhos

```
X-PA-Event:     handoff.requested     # o nome do evento
X-PA-Delivery:  evt_8a1f...           # o eid — use para idempotência
X-PA-Signature: <hex>                 # HMAC-SHA256(corpo_bruto, secret) — HEX PURO, sem prefixo
Content-Type:   application/json
```

## Payload

Todo evento usa o mesmo envelope:

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

| Campo | Tipo | Descrição |
|---|---|---|
| `eid` | string | Id único da entrega (`evt_…`). Também em `X-PA-Delivery`. Deduplique por ele |
| `event` | string | Nome do evento (igual ao `X-PA-Event`) |
| `sent_at` | string | Timestamp ISO-8601 com fuso |
| `data` | object | Campos específicos do evento |

### Exemplos de payload

**`message.sent`** (a resposta do bot)

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

## Validando a assinatura

Calcule o HMAC sobre o **corpo bruto** e compare contra o cabeçalho — **hex puro, sem prefixo** —
em tempo constante:

```python
import hashlib, hmac

def valido(corpo_bruto: bytes, header: str, secret: str) -> bool:
    expected = hmac.new(
        secret.encode(), corpo_bruto, hashlib.sha256
    ).hexdigest()                 # sem prefixo "sha256="
    return hmac.compare_digest(expected, header or "")

# header = request.headers["X-PA-Signature"]
# secret = WEBHOOK_SECRET
```

Depois deduplique pelo `eid` (`X-PA-Delivery`) antes de agir sobre o evento.

## Observações

- **Responda `2xx` rápido**, processe de forma assíncrona. O timeout é de ~12 s.
- **Retries** — até 6 tentativas com backoff `[imediato, 1 min, 5 min, 15 min, 1 h, 3 h]`.
- **`handoff.requested`** é o seu sinal para rotear a conversa a um atendente humano; `motivo`
  explica por que o agente escalou.

## Próximos passos

- [Visão geral de Webhooks](./README.md)
- [Autenticação](../reference/authentication.md)
