# Webhooks

A webhook is an HTTP `POST` that **Pushfy sends to a URL you own** whenever something
happens — a message is delivered, a push is clicked, a conversation is handed off to a human.
Instead of polling our API, you receive events the moment they occur.

- **You provide the URL.** It must be a **public HTTPS** endpoint. Plain HTTP, private ranges
  and loopback addresses are rejected (anti-SSRF).
- **Pushfy signs every request** so you can verify it really came from us.
- **You respond `2xx` quickly.** Anything else is treated as a failure and retried.

There are three webhook families. They share the same delivery mechanics but differ in the
signature header — read the table below carefully.

---

## The three webhook types

| Type | What it reports | Signature header | Signature format |
|---|---|---|---|
| [Messaging status](./messaging-status.md) | SMS/RCS/Voice delivery receipts (DLR) and inbound replies | `X-Pushfy-Signature` | `sha256=<hex>` |
| [Push](./push.md) | Push Notification campaign & device events | `X-Push-Signature` | `sha256=<hex>` |
| [Conversations](./conversations.md) | PushAgent (Conversational AI) events | `X-PA-Signature` | `<hex>` — **raw hex** |

> **⚠️ Watch the signature format.** Messaging and Push send the signature **prefixed**:
> `sha256=<hex>`. Conversations (PushAgent) sends the **raw hex only**, with **no `sha256=`
> prefix**. If you copy a validator between products, adjust the comparison accordingly.

---

## Common rules (Push & Conversations)

The mature webhooks — **Push** and **Conversations** — follow one shared contract:

- **Body is JSON.** Read the raw body; don't assume a content type beyond `application/json`.
- **Every delivery has a unique `eid`.** It appears both in the JSON body and in the delivery
  header (`X-Push-Delivery` / `X-PA-Delivery`). Use it for **idempotency** — deduplicate by `eid`
  so a retried delivery is processed only once.
- **Respond `2xx` fast.** Acknowledge first, process asynchronously. Do your heavy work after you
  return the response.
- **Retries.** A non-`2xx` response (or a timeout) triggers up to **6 attempts** with backoff:
  `[immediate, 1 min, 5 min, 15 min, 1 h, 3 h]`.
- **Timeout.** Roughly **12 seconds**. If you don't answer in time, the delivery is retried.
- **HTTPS only.** The endpoint must be public HTTPS; private/loopback URLs are refused when you
  save the configuration (anti-SSRF).

The Messaging status webhook shares the same signing idea (HMAC-SHA256) but its payload is a
plain array of receipts rather than an enveloped event — see its page for specifics.

---

## Configuring a webhook

In the dashboard: **Settings → Webhooks**. For each webhook type you set:

1. **Delivery URL** — your public HTTPS endpoint, e.g. `https://your-app.com/webhook`.
2. **Secret** — the signing key Pushfy uses to compute the signature (e.g. `WEBHOOK_SECRET`).
   Store it server-side; never expose it in front-end code.

---

## Delivery lifecycle

```
  ┌────────────┐
  │  event      │  a message is delivered / a push is clicked / …
  │  occurs      │
  └─────┬──────┘
        │
        ▼
  ┌──────────────────────────┐
  │  Pushfy signs the raw     │  signature = HMAC-SHA256(raw_body, secret)
  │  body and POSTs it        │  headers: X-*-Signature, X-*-Delivery (eid)
  └─────┬────────────────────┘
        │
        ▼
  ┌──────────────────────────┐
  │  your server validates    │  recompute the signature, compare in constant time
  │  the signature            │  dedupe by eid
  └─────┬────────────────────┘
        │
        ▼
  ┌──────────────────────────┐        non-2xx / timeout
  │  respond 2xx (ack)        │ ───────────────────────────┐
  └─────┬────────────────────┘                             │
        │                                                    ▼
        ▼                                       ┌──────────────────────────┐
  process asynchronously                         │  retry with backoff       │
                                                 │  [now,1m,5m,15m,1h,3h]    │
                                                 └──────────────────────────┘
```

---

## Validating authenticity

Every webhook is signed with **HMAC-SHA256** over the **raw request body** using your secret.
Recompute it and compare in **constant time**.

```
expected = hmac_sha256_hex(raw_body, secret)

# Messaging status  →  compare header against  "sha256=" + expected
# Push              →  compare header against  "sha256=" + expected
# Conversations     →  compare header against  expected          (raw hex, no prefix)
```

Generic pseudo-code:

```python
import hashlib, hmac

def valid(raw_body: bytes, header: str, secret: str, prefixed: bool) -> bool:
    expected = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    if prefixed:
        expected = "sha256=" + expected
    return hmac.compare_digest(expected, header or "")
```

- Use `raw_body` **exactly as received** — do not parse and re-serialize the JSON first, or the
  bytes (and the signature) will differ.
- Compare with a **constant-time** function (`hmac.compare_digest`, `crypto.timingSafeEqual`, …).

---

## Best practices

- **Validate before you trust.** Reject any request whose signature doesn't match — return `401`.
- **Use the raw body.** Never re-serialize the JSON before signing; sign the exact bytes received.
- **Deduplicate by `eid`.** Retries and rare network duplicates mean the same event can arrive
  more than once. Track seen `eid`s.
- **Respond fast, process async.** Acknowledge within the timeout, then do the work.
- **Monitor failures.** Watch for repeated non-`2xx` responses so a broken endpoint doesn't
  silently drop events.
- **Handle redelivery.** Assume any event may be delivered again; make your handlers idempotent.

---

## Next steps

- [Messaging status webhook](./messaging-status.md)
- [Push webhook](./push.md)
- [Conversations webhook](./conversations.md)
- [Authentication](../reference/authentication.md)
