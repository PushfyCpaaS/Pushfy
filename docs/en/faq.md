# API FAQ

Short, direct answers to the questions we hear most. Grouped by topic. For full detail,
follow the links into the reference, webhooks and guides.

---

## Getting started

### How do I get my API key / token?

In the dashboard: **Settings → API Tokens**. Copy the token and send it as a Bearer token on
every messaging request. For the HMAC products (Push server API, PushAgent) create a key under
**Settings → API Keys** instead — the secret is shown **only once**, so store it right away.
See [Authentication](./reference/authentication.md).

### Do I need a credit card to test?

Testing terms depend on your plan. Talk to your account manager to arrange a trial or test
credits — they'll set you up.

### What's the base URL?

Two, depending on the product:

- **Messaging** (SMS/RCS/Voice, status, balance) — `https://portal.pushfy.com` (e.g. `/webapi`,
  `/getstatus`, `/balance`).
- **Push & Conversational AI (V2)** — `https://portal.pushfy.com/v2/api.php?r=<path>`, e.g.
  `.../v2/api.php?r=/v1/conversations`.

Keep credentials server-side. The only credential meant for the browser is the public Push
`app_id`.

---

## Authentication

### What authentication methods are there?

It depends on the product:

- **Messaging** — Bearer token (`Authorization: Bearer …`). Two alternatives are accepted:
  `X-API-TOKEN: …` or `Authorization: Basic base64(login:password)`.
- **Push (device/browser)** — public `app_id` in the body or query.
- **Push (server) & PushAgent** — HMAC-SHA256 with `X-PUSH-*` / `X-PA-*` headers.

See [Authentication](./reference/authentication.md).

### How do I sign an HMAC request?

Build `timestamp + "\n" + METHOD + "\n" + path + "\n" + sha256_hex(body)` and HMAC-SHA256 it with
your secret. `METHOD` is upper-case, `path` is the route **without** the query string, and `body`
is the exact raw bytes. Full recipe and a worked example in
[Authentication](./reference/authentication.md).

### I got a 401 — what should I check?

- The token/key and signature are correct.
- The `timestamp` is within **±300 seconds** of now (HMAC replay window).
- The signed `path` has **no query string**.
- The signed `body` is the **exact raw bytes** you send — don't parse and re-serialize first.

See [Authentication](./reference/authentication.md) and
[Errors & rate limits](./reference/errors.md).

### Is there an IP restriction?

Yes — optionally. Your account can have an IP allow-list; requests from other IPs are rejected
with `403 ip_not_allowed`. Manage the list with your account manager.

---

## SMS

### What's the phone number format?

Digits only, country code first — e.g. `5511999999999`. Non-digits are stripped automatically.
Minimum 8 digits. See [Send SMS](./reference/sms.md).

### How do I send in bulk?

Pass multiple objects in `messages` on `POST /webapi` — **up to 100,000 per request**. Each is
independent and returns its own row. See [Send SMS](./reference/sms.md) and the
[Bulk sending guide](./guides/bulk-sending.md).

### What does the response look like?

An **array**, one object per message: `[{ "id", "phone", "date", "ext_id" }]`. It is **not** an
`{accepted, queued}` object — don't code against that shape. Store `ext_id` for status lookups.
See [Send SMS](./reference/sms.md).

### How many messages does a long text count as?

Messages over 160 characters are sent as multiple **segments** and billed per segment — roughly
**1 segment per ~157 characters**. See [Send SMS](./reference/sms.md).

### Does the `from` field work?

No. The sender/brand is **fixed per account**; a `from` field is ignored.

---

## RCS

### Do I need a campaign?

Depends on the endpoint:

- `POST /apircsnativo.php` — requires an existing **"API RCS"** campaign; without one it returns
  `400 rcs_campaign_not_found`.
- `POST /rcs` — **creates the campaign for you**, no provisioning needed.
- `POST /rcscampaign?cid=<ID>` — appends to a specific campaign you own.

See [Send RCS](./reference/rcs.md).

---

## Voice

### How do I send a voice call?

Two steps: first create the audio with `POST /audio` (upload an `.mp3`, get an audio id back),
then trigger the call with `POST /webapi` putting that id in the `audio` field. A `/webapi`
message carrying an `audio` id is dialed as a voice call. See [Send Voice](./reference/voice.md).

### Is there an `/apitvoz` endpoint?

No. `/apitvoz` does **not** exist and returns `404`. Use the two-step flow above.

---

## Status & balance

### How do I know if a message was delivered?

Two ways: poll `GET /getstatus?ext_id=…` (by message), `/getdate` (by day) or `/reportbydate`
(by period); or receive [status webhooks](./webhooks/messaging-status.md) so updates are pushed
to you instead of polling. See [Delivery status](./reference/status.md).

### What do the statuses mean?

`Delivered`, `Sent`, `Undelivered`, `Rejected`, `Blocked`, `No credits`, `Clicked`, and more —
plus voice-only outcomes (`Answered`, `Not Answered`, …). Full glossary in
[Delivery status](./reference/status.md) and [Errors & rate limits](./reference/errors.md).

### How do I check my balance?

`GET /balance` returns `{"saldo":"1.500"}` — the SMS balance as a **formatted string** with a
thousands separator (`"1.500"` = one thousand five hundred), so strip the separator before doing
math. There is **no public voice-balance endpoint**. See [Balance](./reference/balance.md).

---

## Webhooks

### How do I receive statuses at my own URL?

Configure a webhook in the dashboard (**Settings → Webhooks**) with your public HTTPS URL and a
signing secret. Pushfy then POSTs delivery receipts (and inbound replies) to you. See
[Messaging status webhook](./webhooks/messaging-status.md) and the
[Webhooks overview](./webhooks/README.md).

### Why doesn't the PushAgent signature have a `sha256=` prefix?

Because PushAgent (Conversations) sends the signature as **raw hex, with no prefix**. Messaging
(`X-Pushfy-Signature`) and Push (`X-Push-Signature`) send it **prefixed**: `sha256=<hex>`. If you
copy a validator between products, adjust the comparison. See
[Webhooks overview](./webhooks/README.md).

### How do I validate a webhook?

Compute HMAC-SHA256 over the **raw request body** with your secret, then compare in **constant
time** (`hmac.compare_digest` / `crypto.timingSafeEqual`). Sign the exact bytes received — never
parse and re-serialize the JSON first. See [Webhooks overview](./webhooks/README.md).

### Do you retry failed deliveries?

Yes. A non-`2xx` response or timeout triggers up to **6 attempts** with backoff
(`[immediate, 1 min, 5 min, 15 min, 1 h, 3 h]`). Respond `2xx` fast and process asynchronously.
See [Webhooks overview](./webhooks/README.md).

### How do I avoid processing an event twice?

Deduplicate by **`eid`** — every Push/Conversations delivery carries a unique `eid` (in the body
and the `X-*-Delivery` header). Track seen `eid`s so a retried delivery is handled once. See
[Webhooks overview](./webhooks/README.md).

---

## Limits & errors

### What are the rate limits?

They vary by API (e.g. PushAgent 300/60s, Push 600–1200/60s depending on scope). Full table in
[Errors & rate limits](./reference/errors.md).

### What do I do on a 429?

Back off with **exponential backoff** (1s, 2s, 4s, 8s… plus jitter) and resume — don't retry in a
tight loop. See [Errors & rate limits](./reference/errors.md).

### I got a timeout on send — should I resend?

**Not blindly.** The request may have succeeded server-side, so a blind resend risks a **duplicate
charge**. Look up the status by `ext_id` first, and only resend if it truly didn't land. See
[Delivery status](./reference/status.md) and the
[Retry & error-handling guide](./guides/error-handling.md).

---

## Idempotency

### How do I make sure I don't send duplicates?

- **Messaging** — set your own `ext_id` on each message and reuse it on retries; then look up by
  `ext_id` before resending after a timeout.
- **Push server API** — send an `Idempotency-Key` header (≤120 chars) on write calls; repeating
  the same key returns the original response instead of acting twice.

See [Authentication](./reference/authentication.md) and
[Errors & rate limits](./reference/errors.md).

---

## SDKs & tooling

### Do you have an SDK?

Yes. Client SDKs are available — see the SDKs section of the developer portal (`/sdks`).

### Is there an OpenAPI spec or Postman collection?

Yes to both: an OpenAPI spec (`/openapi`) and a Postman collection (`/postman`) are available from
the developer portal.

---

## Next steps

- [Authentication](./reference/authentication.md)
- [Send SMS](./reference/sms.md)
- [Delivery status](./reference/status.md)
- [Errors & rate limits](./reference/errors.md)
- [Webhooks](./webhooks/README.md)
