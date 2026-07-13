# Receiving webhooks

A webhook is an HTTP `POST` that **Pushfy sends to a URL you own** the moment something
happens — a message is delivered, a push is clicked, a conversation is handed off. Instead
of polling, you receive events as they occur.

This guide walks through building a receiver you can trust: stand up a public HTTPS
endpoint, **validate the signature** (all three variants), respond `2xx` fast,
**deduplicate by `eid`**, and process asynchronously.

For the delivery mechanics, retries, and payload shapes, see the
[Webhooks overview](../webhooks/README.md).

---

## Step 1 — Stand up a public HTTPS endpoint

Requirements Pushfy enforces:

- **Public HTTPS.** Plain HTTP, private ranges and loopback addresses are rejected when you
  save the configuration (anti-SSRF). `https://your-app.com/webhook` is fine;
  `http://localhost` is not.
- **Fast responses.** The timeout is roughly **12 seconds**. Miss it and the delivery is
  retried.

Configure the URL and a signing **secret** in the dashboard under **Settings → Webhooks**.
Store the secret server-side; never put it in front-end code.

---

## Step 2 — Know your signature variant

Every webhook is signed with **HMAC-SHA256 over the raw request body** using your secret.
There are three families, and **the header and format differ** — this trips people up:

| Webhook | Header | Format |
|---|---|---|
| [Messaging status](../webhooks/messaging-status.md) | `X-Pushfy-Signature` | `sha256=<hex>` (prefixed) |
| [Push](../webhooks/push.md) | `X-Push-Signature` | `sha256=<hex>` (prefixed) |
| [Conversations](../webhooks/conversations.md) (PushAgent) | `X-PA-Signature` | `<hex>` — **raw hex, no prefix** |

> **⚠️ Watch the prefix.** Messaging and Push send `sha256=<hex>`. Conversations sends the
> **raw hex only**. If you copy a validator between products, adjust the comparison.

The recipe is the same either way:

```
expected = hmac_sha256_hex(raw_body, secret)
# Messaging / Push  ->  compare header against  "sha256=" + expected
# Conversations     ->  compare header against  expected      (raw hex)
```

Two rules that matter:

- Use the **raw body exactly as received** — do **not** parse and re-serialize the JSON
  first, or the bytes (and the signature) will differ.
- Compare in **constant time** (`hmac.compare_digest`, `crypto.timingSafeEqual`).

---

## Step 3 — Respond `2xx` fast, process async

Acknowledge within the timeout, then do the heavy work afterwards. A non-`2xx` response (or
a timeout) triggers up to **6 retries** with backoff `[immediate, 1m, 5m, 15m, 1h, 3h]`.
So: validate, enqueue, return `200` — then process off the request path.

---

## Step 4 — Deduplicate by `eid`

Retries and rare network duplicates mean the **same event can arrive more than once**. The
Push and Conversations webhooks carry a unique **`eid`** in both the JSON body and a
delivery header (`X-Push-Delivery` / `X-PA-Delivery`). Track seen `eid`s and skip
duplicates so a redelivery is processed only once.

(The Messaging status webhook sends an array of receipts rather than an enveloped event —
deduplicate/correlate those by the `ext_id` on each row instead. See
[Messaging status webhook](../webhooks/messaging-status.md).)

---

## Minimal handler — Node / Express

Handles all three variants: pick the header/prefix by webhook type. Note `express.raw` so
we sign the **exact bytes**.

```js
const express = require("express");
const crypto = require("crypto");

const app = express();
const SECRET = process.env.WEBHOOK_SECRET;   // from Settings → Webhooks
const seen = new Set();                       // use Redis/DB in production

// verify(raw, header, prefixed) -> bool, constant-time
function verify(raw, header, prefixed) {
  let expected = crypto.createHmac("sha256", SECRET).update(raw).digest("hex");
  if (prefixed) expected = "sha256=" + expected;
  const a = Buffer.from(expected);
  const b = Buffer.from(header || "");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// raw body — do NOT let a JSON parser touch the bytes before we verify
app.post("/webhook", express.raw({ type: "*/*" }), (req, res) => {
  const raw = req.body;                        // Buffer

  // Pick the variant by which header is present:
  let header, prefixed;
  if (req.get("X-Pushfy-Signature")) { header = req.get("X-Pushfy-Signature"); prefixed = true;  }  // messaging
  else if (req.get("X-Push-Signature")) { header = req.get("X-Push-Signature"); prefixed = true;  }  // push
  else if (req.get("X-PA-Signature"))   { header = req.get("X-PA-Signature");   prefixed = false; }  // conversations
  else return res.sendStatus(401);

  if (!verify(raw, header, prefixed)) return res.sendStatus(401);

  const payload = JSON.parse(raw.toString("utf8"));

  // Dedupe: Push/Conversations carry an eid; messaging is an array of receipts.
  const eid = req.get("X-Push-Delivery") || req.get("X-PA-Delivery") || payload.eid;
  if (eid) {
    if (seen.has(eid)) return res.sendStatus(200);  // already handled
    seen.add(eid);
  }

  res.sendStatus(200);                          // ack FAST
  setImmediate(() => process(payload));         // then work async
});

app.listen(3000);
```

---

## Minimal handler — PHP

```php
<?php
$secret = getenv('WEBHOOK_SECRET');            // from Settings → Webhooks
$raw    = file_get_contents('php://input');    // exact bytes — sign these

// Pick the variant by header:
$h = getallheaders();
if (isset($h['X-Pushfy-Signature'])) { $header = $h['X-Pushfy-Signature']; $prefixed = true;  } // messaging
elseif (isset($h['X-Push-Signature'])) { $header = $h['X-Push-Signature']; $prefixed = true;  } // push
elseif (isset($h['X-PA-Signature']))   { $header = $h['X-PA-Signature'];   $prefixed = false; } // conversations
else { http_response_code(401); exit; }

$expected = hash_hmac('sha256', $raw, $secret);
if ($prefixed) $expected = 'sha256=' . $expected;

if (!hash_equals($expected, $header)) {         // constant-time
    http_response_code(401); exit;
}

$payload = json_decode($raw, true);

// Dedupe by eid (Push/Conversations); messaging is an array of receipts.
$eid = $h['X-Push-Delivery'] ?? $h['X-PA-Delivery'] ?? ($payload['eid'] ?? null);
if ($eid && already_seen($eid)) { http_response_code(200); exit; }
if ($eid) mark_seen($eid);

http_response_code(200);                        // ack FAST
// then enqueue $payload for async processing
```

---

## Checklist

- [ ] Endpoint is **public HTTPS** (no HTTP/loopback).
- [ ] Validate the signature over the **raw body**, in **constant time**.
- [ ] Use the right header + prefix for each webhook family.
- [ ] Return `401` on a bad signature; **`2xx` fast** on a good one.
- [ ] **Deduplicate by `eid`** (or `ext_id` for messaging receipts).
- [ ] Process **asynchronously**, after acknowledging.
- [ ] Make handlers **idempotent** — assume any event may be redelivered.

---

## Next steps

- [Webhooks overview](../webhooks/README.md) — delivery lifecycle and best practices.
- [Messaging status webhook](../webhooks/messaging-status.md) ·
  [Push webhook](../webhooks/push.md) ·
  [Conversations webhook](../webhooks/conversations.md).
- [Authentication](../reference/authentication.md).
