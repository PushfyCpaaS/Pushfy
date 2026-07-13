# Migrating from the old docs to the unified API

Let's be honest up front: **your existing SMS, RCS and Voice integrations keep working.**
The classic Messaging endpoints haven't moved. What changed is the **documentation** — the
old public docs contained several **factual errors**, and this unified reference corrects
them. If your code was written against the old docs, it may be handling responses that
never actually had the shape the docs claimed.

This guide has two parts:

1. **Corrections** — where the old docs were wrong, so you can fix your parsing.
2. **Adopting the new products** — Push and PushAgent via the V2 gateway, and moving from
   legacy postbacks to signed self-service webhooks.

---

## Part 1 — Corrections to the old docs

The endpoints are the same; the **documented behavior** was wrong. Audit your code against
this table.

| Topic | Old docs claimed | Actual behavior (this reference) |
|---|---|---|
| `POST /webapi` response | An object like `{ "accepted": N, "queued": N }` | A **JSON array**, one object per message: `[{id, phone, date, ext_id}]` |
| `GET /balance` response | A numeric balance | `{ "saldo": "1.500" }` — a **formatted string** with a thousands separator; parse before doing math |
| `GET /getstatus` response | A single status object | A **JSON array**, one object per matching message |
| `GET /getstatus` lookup key | `ext_id` only | Accepts **`ext_id` or `uid`** (internal message id) |
| `POST /apitvoz` (send voice) | A dedicated voice endpoint | **Does not exist** — returns `404`. Voice is `/webapi` with an `audio` field |
| `GET /balancetvoz` (voice balance) | A voice-balance endpoint | **Does not exist** — returns `404`. There is no public voice-balance endpoint |
| `/getstatus` / `/reportbydate` / `/getdate` results | Single objects | **Arrays** — always iterate, even for one item |

### What to change in your code

- **Parse sends as arrays.** After `POST /webapi`, iterate the array and read each row's
  `ext_id` — don't read `response.accepted`. See [Send SMS](../reference/sms.md).
- **Parse `saldo` as a string.** Strip the thousands separator before arithmetic:
  `"1.500"` means 1500, not 1.5. See [Balance](../reference/balance.md).
- **Treat every status response as an array.** `/getstatus`, `/getdate` and
  `/reportbydate` all return arrays. See [Delivery status](../reference/status.md).
- **Delete calls to `/apitvoz` and `/balancetvoz`.** For voice, upload an `.mp3` to
  `/audio`, then send on `/webapi` with the returned id in the `audio` field. There's no
  public voice balance. See [Send Voice](../reference/voice.md).
- **Remember status text can be plain text.** A few status endpoints return plain-text
  errors (`Unauthorized`, `Messages not found`), not JSON — don't assume JSON on non-`200`.
  See [Errors & rate limits](../reference/errors.md).

> None of these require re-integrating. They're **parsing fixes** so your code matches what
> the endpoints have always actually returned.

---

## Part 2 — Adopting the new products

The new products — **Push Notifications** and **PushAgent** (Conversational AI) — live
behind a single V2 gateway:

```
https://portal.pushfy.com/v2/api.php?r=<route>
```

They authenticate with **HMAC-SHA256**, not a Bearer token. Each request carries a key, a
timestamp, and a signature over `timestamp + method + path + sha256(body)`:

| Product | Key header | Timestamp | Signature | Key / secret |
|---|---|---|---|---|
| Push (server) | `X-PUSH-Key` | `X-PUSH-Timestamp` | `X-PUSH-Signature` | `pushk_` / `pss_` |
| PushAgent | `X-PA-Key` | `X-PA-Timestamp` | `X-PA-Signature` | `pak_` / `pas_` |

Get the credentials in **Settings → API Keys** (the secret is shown **once**). The full
signing recipe is in [Authentication](../reference/authentication.md#signing-recipe), and
V2 errors use `{ "ok": false, "error": "..." }` — see
[Errors & rate limits](../reference/errors.md).

To create and send a Push campaign end-to-end, follow the
[Create a campaign guide](./campaigns.md).

### From legacy postbacks to signed webhooks

If you were consuming **legacy postbacks** for delivery receipts, migrate to the
**self-service, signed webhooks**. They're configured per account in **Settings → Webhooks**
and signed with HMAC-SHA256 so you can verify authenticity:

| Events | Webhook | Signature header |
|---|---|---|
| SMS/RCS/Voice DLR + inbound replies | [Messaging status](../webhooks/messaging-status.md) | `X-Pushfy-Signature: sha256=<hex>` |
| Push campaign/device events | [Push](../webhooks/push.md) | `X-Push-Signature: sha256=<hex>` |
| PushAgent conversation events | [Conversations](../webhooks/conversations.md) | `X-PA-Signature: <hex>` (raw) |

Validate the signature over the **raw body**, respond `2xx` fast, and deduplicate — the
[Receiving webhooks guide](./receiving-webhooks.md) has ready-to-use handlers.

> **Honesty note.** The messaging status webhook is still being rolled out self-service. If
> it isn't active on your account yet, ask your **account manager** to enable it.

---

## Migration checklist

- [ ] `/webapi` responses parsed as an **array** (not `{accepted, queued}`).
- [ ] `saldo` parsed as a **formatted string** (strip the thousands separator).
- [ ] `/getstatus`, `/getdate`, `/reportbydate` all handled as **arrays**.
- [ ] `/getstatus` optionally keyed by **`uid`** where useful, not only `ext_id`.
- [ ] All calls to **`/apitvoz`** removed → voice via `/audio` + `/webapi` `audio` field.
- [ ] All calls to **`/balancetvoz`** removed → no public voice-balance endpoint.
- [ ] Non-`200` status responses handled as possibly **plain text**.
- [ ] New products (Push / PushAgent) integrated via **`/v2/api.php` + HMAC**.
- [ ] Legacy postbacks replaced with **signed self-service webhooks** (with signature
      validation and `eid`/`ext_id` dedupe).

---

## Next steps

- [Endpoint index](../reference/endpoints.md) — the authoritative, verified list.
- [Send your first message](./first-message.md) · [Create a campaign](./campaigns.md).
- [Receiving webhooks](./receiving-webhooks.md) · [Handling errors](./error-handling.md).
