# Webhook de Push

Receba eventos de campanha e dispositivo do **Push Notifications** como `POST` HTTP na sua própria
URL.

- **Direção** — Pushfy → seu endpoint (`https://your-app.com/webhook`)
- **Método** — `POST`
- **Assinatura** — `X-Push-Signature: sha256=<hex>`, em que
  `<hex> = HMAC-SHA256(corpo_bruto, WEBHOOK_SECRET)`
- **Content-Type** — `application/json`

## Eventos

| Evento | Quando dispara |
|---|---|
| `campaign.sent` | Uma campanha foi disparada |
| `campaign.completed` | Uma campanha terminou de processar todos os destinatários |
| `push.delivered` | Uma notificação chegou a um dispositivo |
| `push.opened` | O usuário abriu uma notificação |
| `push.clicked` | O usuário clicou em uma notificação |
| `device.subscribed` | Um dispositivo/navegador se inscreveu |
| `device.unsubscribed` | Um dispositivo/navegador cancelou a inscrição |
| `conversion.recorded` | Uma conversão rastreada foi registrada |

## Cabeçalhos

```
X-Push-Event:     push.clicked          # o nome do evento
X-Push-Delivery:  evt_9f2a...           # o eid — use para idempotência
X-Push-Signature: sha256=<hex>          # HMAC-SHA256(corpo_bruto, secret)
Content-Type:     application/json
```

## Payload

Todo evento usa o mesmo envelope:

```json
{
  "eid": "evt_9f2a3c8d1e4b",
  "event": "push.clicked",
  "sent_at": "2026-07-12T13:50:00-03:00",
  "data": {
    "device_id": 551,
    "campaign_id": 91,
    "value": null
  }
}
```

| Campo | Tipo | Descrição |
|---|---|---|
| `eid` | string | Id único da entrega (`evt_…`). Também em `X-Push-Delivery`. Deduplique por ele |
| `event` | string | Nome do evento (igual ao `X-Push-Event`) |
| `sent_at` | string | Timestamp ISO-8601 com fuso |
| `data` | object | Campos específicos do evento |

### Exemplos de payload

**`campaign.completed`**

```json
{
  "eid": "evt_71b0c4aa9f21",
  "event": "campaign.completed",
  "sent_at": "2026-07-12T13:45:10-03:00",
  "data": {
    "campaign_id": 91,
    "value": null
  }
}
```

**`device.subscribed`**

```json
{
  "eid": "evt_2c55e0af7788",
  "event": "device.subscribed",
  "sent_at": "2026-07-12T13:48:22-03:00",
  "data": {
    "device_id": 551,
    "campaign_id": null,
    "value": null
  }
}
```

**`conversion.recorded`**

```json
{
  "eid": "evt_a13f9d02bc47",
  "event": "conversion.recorded",
  "sent_at": "2026-07-12T13:52:41-03:00",
  "data": {
    "device_id": 551,
    "campaign_id": 91,
    "value": 149.90
  }
}
```

## Secret

O secret de assinatura é gerado no painel (**Configurações → Webhooks**) como um valor com prefixo
`whsec_…`. Ele é exibido uma única vez — guarde como `WEBHOOK_SECRET` no servidor.

## Validando a assinatura

Calcule o HMAC sobre o **corpo bruto**, prefixe com `sha256=` e compare em tempo constante:

```python
import hashlib, hmac

def valido(corpo_bruto: bytes, header: str, secret: str) -> bool:
    expected = "sha256=" + hmac.new(
        secret.encode(), corpo_bruto, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, header or "")

# header = request.headers["X-Push-Signature"]
# secret = WEBHOOK_SECRET   (seu valor whsec_...)
```

Depois deduplique pelo `eid` (`X-Push-Delivery`) antes de agir sobre o evento.

## Observações

- **Responda `2xx` rápido**, processe de forma assíncrona. O timeout é de ~12 s.
- **Retries** — até 6 tentativas com backoff `[imediato, 1 min, 5 min, 15 min, 1 h, 3 h]`.
- **`data.value`** vem preenchido em eventos com valor (ex.: `conversion.recorded`) e `null` nos
  demais.

## Próximos passos

- [Visão geral de Webhooks](./README.md)
- [Autenticação](../reference/authentication.md)
