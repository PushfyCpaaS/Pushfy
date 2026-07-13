# Send your first message

This guide takes you from zero to a delivered SMS in four steps: get a token, send a
message, read the response, and check delivery status. Every command is a real `curl`
you can copy — just replace the placeholders.

By the end you will understand the two things that matter most in the Pushfy Messaging
API: **the send response is an array**, and **`ext_id` is how you correlate a message
later**.

---

## Before you start

You need:

- A Pushfy account with Messaging enabled.
- A terminal with `curl`.
- One test phone number you control, in **digits only, country code first** — e.g.
  `5511999999999`.

---

## Step 1 — Get your API token

Your token lives in the dashboard under **Settings → API Tokens**. Copy it and keep it
**server-side** — never ship a messaging token in a browser or mobile app.

Every Messaging request carries it as a Bearer header:

```
Authorization: Bearer YOUR_API_TOKEN
```

Two alternatives are accepted if they suit you better — `X-API-TOKEN: YOUR_API_TOKEN`,
or HTTP Basic with your account login and password. See
[Authentication](../reference/authentication.md) for details.

A quick way to confirm the token works is to read your balance:

```bash
curl 'https://portal.pushfy.com/balance' \
  -H 'Authorization: Bearer YOUR_API_TOKEN'
```

```json
{ "saldo": "1.500" }
```

`saldo` is your SMS balance as a **formatted string** (`"1.500"` = one thousand five
hundred). If you get `unauthorized`, the token is wrong; if you get `ip_not_allowed`,
your account has an IP allow-list — see [Balance](../reference/balance.md) and
[Authentication](../reference/authentication.md).

---

## Step 2 — Send an SMS

Send SMS with `POST /webapi`. It **queues** the message and returns immediately, which is
what you want for anything beyond a one-off.

Note two things in the body below:

- `ext_id` — **your** reference id. Set it yourself so you can look the message up later.
  If you omit it, one is generated for you and returned in the response.
- `destinations` is a list, but **only the first entry is used**. One recipient per
  message; add more objects to `messages` for more recipients.

```bash
curl -X POST 'https://portal.pushfy.com/webapi' \
  -H 'Authorization: Bearer YOUR_API_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "messages": [
      {
        "ext_id": "hello-001",
        "destinations": [{ "to": "5511999999999" }],
        "text": "Hello from Pushfy 👋"
      }
    ]
  }'
```

`Content-Type: application/json` is required. See [Send SMS](../reference/sms.md) for the
full field reference.

---

## Step 3 — Read the response

A successful send returns **`200 OK` with a JSON array** — one object per message, in the
same order you sent them:

```json
[
  {
    "id": "hello-001",
    "phone": "5511999999999",
    "date": "2026-07-12 14:33:21",
    "ext_id": "hello-001"
  }
]
```

> **The response is always an array — even for a single message.** Iterate over it; don't
> read `response.id` as if it were an object. This is the single most common first-time
> mistake, and older documentation described a different shape.

Store the `ext_id` from each row against your own records. That's your key for Step 4.

A `200` here means Pushfy **accepted and queued** the message — not that it reached the
handset yet. Delivery is confirmed separately.

---

## Step 4 — Check delivery status by `ext_id`

Look the message up with `GET /getstatus` using the `ext_id` you sent:

```bash
curl 'https://portal.pushfy.com/getstatus?ext_id=hello-001' \
  -H 'Authorization: Bearer YOUR_API_TOKEN'
```

The response is **also an array**, one object per matching message:

```json
[
  {
    "phone": "5511999999999",
    "status": "Delivered",
    "date": "2026-07-12 14:33:21",
    "channel": "SMS",
    "statustvoz": null
  }
]
```

`status` moves through the message lifecycle — it may read `Waiting` or `Sent` for a
moment before a `Delivered` receipt (DLR) arrives from the carrier. If so, query again a
little later. The full list of values is in the
[status glossary](../reference/status.md#status-glossary).

> Under heavy load `/getstatus` can answer `503`. That's temporary — retry with a short
> backoff.

---

## What you just learned

- Get your token from **Settings → API Tokens** and keep it server-side.
- `POST /webapi` queues an SMS and returns a **JSON array**.
- Set your own **`ext_id`** so you can correlate the message afterwards.
- `GET /getstatus?ext_id=...` returns the delivery status — also an array.

---

## Next steps

- Instead of polling per message, get pushed delivery receipts with the
  [messaging status webhook](../webhooks/messaging-status.md).
- Send at scale — see [Send thousands of messages](./bulk-sending.md).
- Retry safely without double-charging — see [Handling errors](./error-handling.md).
- Add rich RCS cards or voice calls — see [Send RCS](../reference/rcs.md) and
  [Send Voice](../reference/voice.md).
