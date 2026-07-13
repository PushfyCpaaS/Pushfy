# Messaging status webhook

Receive **delivery receipts (DLR)** and **inbound replies** for your SMS, RCS and Voice traffic
as HTTP `POST`s to your own URL — no polling required.

- **Direction** — Pushfy → your endpoint (`https://your-app.com/webhook`)
- **Method** — `POST`
- **Signature** — `X-Pushfy-Signature: sha256=<hex>`, where
  `<hex> = HMAC-SHA256(raw_body, WEBHOOK_SECRET)`
- **Content-Type** — `application/json`

There are **two event kinds**, distinguished by their payload shape:

| Kind | Meaning |
|---|---|
| `status` | A delivery receipt (DLR) — the outcome of a message you sent |
| `respostas` | An inbound reply (MO) — a message the recipient sent back |

Both payloads are a **JSON array** — a single delivery may batch several items.

---

## `status` — delivery receipts (DLR)

```json
[
  {
    "id": 123,
    "phone": "5511999999999",
    "status": "Delivered",
    "text": "Your order #1042 has shipped 🚚",
    "date_dlr": "2026-07-12 10:30:00",
    "ext_id": "order-1042",
    "date": "2026-07-12 10:00:00",
    "channel": "SMS",
    "cost": "0.06",
    "status_code": 0,
    "statustvoz": null
  }
]
```

| Field | Type | Description |
|---|---|---|
| `id` | number | Pushfy message id |
| `phone` | string | Recipient, digits only, country code first |
| `status` | string | Human-readable delivery status (see below) |
| `text` | string | The message body that was sent |
| `date_dlr` | string | When this receipt was produced (`YYYY-MM-DD HH:MM:SS`) |
| `ext_id` | string | **Your** reference, echoed from the original send — use it to correlate |
| `date` | string | When the message was submitted |
| `channel` | string | `SMS`, `RCS` or `VOICE` |
| `cost` | string | Charged cost for this message |
| `status_code` | number | Numeric status (see map below) |
| `statustvoz` | string / null | Voice-only sub-status; `null` for SMS/RCS |

**`status` values**

`Sent`, `Delivered`, `Undelivered`, `Invalid`, `Rejected`, `Expired`, `Blocked`,
`No credits`, `Clicked`, `Characters Exceeded`.

**`status_code` map**

| Code | Meaning |
|---|---|
| `9` | Sent |
| `1` | Undelivered |
| `2` | Invalid |
| `3` | Rejected |
| `4` | Expired |
| `5` | Blocked |
| `6` | Characters Exceeded |
| `7` | No credits |
| `0` | Any other status (e.g. `Delivered`, `Clicked`) |

- **`channel`** is one of `SMS` | `RCS` | `VOICE`.
- **`statustvoz`** carries extra detail for **Voice** only; it is `null` on `SMS`/`RCS`.

---

## `respostas` — inbound replies (MO)

When a recipient replies to your SMS or RCS, you receive their message:

```json
[
  {
    "phone": "5511999999999",
    "reply": "YES, confirm my appointment",
    "campaign_id": 123,
    "message_id": 456,
    "message": "Reply YES to confirm",
    "to": "5511888888888",
    "received_at": "2026-07-12 10:31:00"
  }
]
```

| Field | Type | Description |
|---|---|---|
| `phone` | string | The customer's number (who replied) |
| `reply` | string | The text the customer sent |
| `campaign_id` | number | Campaign that originated the conversation |
| `message_id` | number | The outbound message the customer is replying to |
| `message` | string | The original outbound text |
| `to` | string | The number/sender the reply was addressed to |
| `received_at` | string | When the reply arrived (`YYYY-MM-DD HH:MM:SS`) |

---

## Validating the signature

Compute the HMAC over the **raw body** and compare — prefixed — against the header, in
constant time:

```python
import hashlib, hmac

def valid(raw_body: bytes, header: str, secret: str) -> bool:
    expected = "sha256=" + hmac.new(
        secret.encode(), raw_body, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, header or "")

# header = request.headers["X-Pushfy-Signature"]
# secret = WEBHOOK_SECRET
```

Sign the exact bytes received — do not parse and re-serialize the JSON first.

---

## Notes

- **Self-service, per account.** The status webhook is configured in the dashboard
  (**Settings → Webhooks**). If it isn't active on your account yet, ask your **account manager**
  to enable it — we're honest that this one is still being rolled out self-service.
- **Correlate with `ext_id`.** Match each receipt to your own records using the `ext_id` you
  supplied when [sending](../reference/sms.md). If you didn't set one, one was auto-generated and
  returned in the send response.
- **Arrays, always.** Both `status` and `respostas` arrive as arrays — iterate, even for a single
  item.
- **Voice.** For voice calls, read `statustvoz` alongside `status` for the call-level outcome.

---

## Next steps

- [Check delivery status via the API](../reference/status.md)
- [Webhooks overview](./README.md)
