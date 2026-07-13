# Webhook de status de mensageria

Receba **recibos de entrega (DLR)** e **respostas recebidas** do seu tráfego de SMS, RCS e Voz
como `POST` HTTP na sua própria URL — sem precisar ficar consultando.

- **Direção** — Pushfy → seu endpoint (`https://your-app.com/webhook`)
- **Método** — `POST`
- **Assinatura** — `X-Pushfy-Signature: sha256=<hex>`, em que
  `<hex> = HMAC-SHA256(corpo_bruto, WEBHOOK_SECRET)`
- **Content-Type** — `application/json`

Há **dois tipos de evento**, distinguidos pelo formato do payload:

| Tipo | Significado |
|---|---|
| `status` | Um recibo de entrega (DLR) — o desfecho de uma mensagem que você enviou |
| `respostas` | Uma resposta recebida (MO) — uma mensagem que o destinatário mandou de volta |

Ambos os payloads são um **array JSON** — uma única entrega pode agrupar vários itens.

---

## `status` — recibos de entrega (DLR)

```json
[
  {
    "id": 123,
    "phone": "5511999999999",
    "status": "Delivered",
    "text": "Seu pedido #1042 foi enviado 🚚",
    "date_dlr": "2026-07-12 10:30:00",
    "ext_id": "pedido-1042",
    "date": "2026-07-12 10:00:00",
    "channel": "SMS",
    "cost": "0.06",
    "status_code": 0,
    "statustvoz": null
  }
]
```

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | número | Id da mensagem no Pushfy |
| `phone` | string | Destinatário, só dígitos, código do país primeiro |
| `status` | string | Status de entrega legível (veja abaixo) |
| `text` | string | O corpo da mensagem enviada |
| `date_dlr` | string | Quando este recibo foi produzido (`AAAA-MM-DD HH:MM:SS`) |
| `ext_id` | string | **Sua** referência, ecoada do envio original — use para correlacionar |
| `date` | string | Quando a mensagem foi submetida |
| `channel` | string | `SMS`, `RCS` ou `VOICE` |
| `cost` | string | Custo cobrado desta mensagem |
| `status_code` | número | Status numérico (veja o mapa abaixo) |
| `statustvoz` | string / null | Sub-status só de voz; `null` para SMS/RCS |

**Valores de `status`**

`Sent`, `Delivered`, `Undelivered`, `Invalid`, `Rejected`, `Expired`, `Blocked`,
`No credits`, `Clicked`, `Characters Exceeded`.

**Mapa de `status_code`**

| Código | Significado |
|---|---|
| `9` | Sent |
| `1` | Undelivered |
| `2` | Invalid |
| `3` | Rejected |
| `4` | Expired |
| `5` | Blocked |
| `6` | Characters Exceeded |
| `7` | No credits |
| `0` | Qualquer outro status (ex.: `Delivered`, `Clicked`) |

- **`channel`** é um de `SMS` | `RCS` | `VOICE`.
- **`statustvoz`** traz detalhe extra apenas para **Voz**; vem `null` em `SMS`/`RCS`.

---

## `respostas` — respostas recebidas (MO)

Quando um destinatário responde ao seu SMS ou RCS, você recebe a mensagem dele:

```json
[
  {
    "phone": "5511999999999",
    "reply": "SIM, confirmar meu agendamento",
    "campaign_id": 123,
    "message_id": 456,
    "message": "Responda SIM para confirmar",
    "to": "5511888888888",
    "received_at": "2026-07-12 10:31:00"
  }
]
```

| Campo | Tipo | Descrição |
|---|---|---|
| `phone` | string | Número do cliente (quem respondeu) |
| `reply` | string | O texto que o cliente enviou |
| `campaign_id` | número | Campanha que originou a conversa |
| `message_id` | número | A mensagem de saída a que o cliente está respondendo |
| `message` | string | O texto de saída original |
| `to` | string | O número/remetente a que a resposta foi endereçada |
| `received_at` | string | Quando a resposta chegou (`AAAA-MM-DD HH:MM:SS`) |

---

## Validando a assinatura

Calcule o HMAC sobre o **corpo bruto** e compare — com prefixo — contra o cabeçalho, em tempo
constante:

```python
import hashlib, hmac

def valido(corpo_bruto: bytes, header: str, secret: str) -> bool:
    expected = "sha256=" + hmac.new(
        secret.encode(), corpo_bruto, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, header or "")

# header = request.headers["X-Pushfy-Signature"]
# secret = WEBHOOK_SECRET
```

Assine os bytes exatos recebidos — não faça parse e re-serialize o JSON antes.

---

## Observações

- **Self-service, por conta.** O webhook de status é configurado no painel
  (**Configurações → Webhooks**). Se ainda não estiver ativo na sua conta, peça ao seu **gerente de
  conta** para habilitar — sendo honesto, esse aqui ainda está em rollout self-service.
- **Correlacione pelo `ext_id`.** Case cada recibo com os seus registros usando o `ext_id` que você
  informou no [envio](../reference/sms.md). Se você não definiu um, ele foi gerado automaticamente e
  devolvido na resposta do envio.
- **Sempre arrays.** Tanto `status` quanto `respostas` chegam como arrays — itere, mesmo com um só
  item.
- **Voz.** Para chamadas de voz, leia `statustvoz` junto de `status` para o desfecho da ligação.

---

## Próximos passos

- [Consultar status de entrega pela API](../reference/status.md)
- [Visão geral de Webhooks](./README.md)
