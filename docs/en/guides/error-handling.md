# Handling errors

Networks fail, servers hiccup, and requests time out. This guide shows how to retry Pushfy
calls **safely** — without ever charging a customer twice. The core rule:

> **Never blindly resend after a send timeout.** The request may have succeeded
> server-side, so a blind resend risks a **duplicate charge**. Look up the status by
> `ext_id` first, and only resend if it truly didn't land.

---

## Step 1 — Know which error format you're reading

Pushfy spans two generations of API, and they report errors differently. Detect the shape
before you branch on it.

**Messaging (classic API)** — a JSON object with an `error` string:

```json
{ "error": "unauthorized" }
```

A few **status endpoints answer in plain text** instead of JSON (`Unauthorized`,
`Messages not found`, `id parameter is missing`). Don't assume every messaging response is
JSON — check the `Content-Type` or fall back to the raw body on a non-`200`.

**V2 API (Push / PushAgent)** — always a JSON object with an `ok` flag:

```json
{ "ok": false, "error": "rate_limited" }
```

On success V2 returns `"ok": true`. See [Errors & rate limits](../reference/errors.md) for
the full catalog of strings.

---

## Step 2 — Retry only what's retryable

Retrying a client error (a `4xx` you caused) just repeats the same failure. Retry only the
transient classes:

| Situation | Retry? | How |
|---|---|---|
| **`5xx`** (`500`, `503`, `db_error`, `insert_error`, `internal`) | ✅ | Exponential backoff |
| **Timeout / connection reset** | ✅ (carefully) | Backoff — **but see Step 4 for sends** |
| **`429` `rate_limited`** | ✅ | Back off, then resume — don't hammer |
| **`400`** (`invalid_json`, `max_100000`, missing field…) | ❌ | Fix the request |
| **`401` `unauthorized`** | ❌ | Fix the token / re-sign |
| **`403`** (`ip_not_allowed`, `produto_inativo`) | ❌ | Fix config / enable product |
| **`404`, `405`, `413`, `415`** | ❌ | Fix the request |

**Exponential backoff** means waiting a growing delay between attempts — e.g. 1s, 2s, 4s,
8s — plus a little random **jitter** so many clients don't retry in lockstep. Never retry
in a tight loop.

---

## Step 3 — Make retries idempotent

A retry is only safe if repeating it can't create a second message or a second charge.
Pushfy gives you two idempotency tools:

- **Messaging — reuse the same `ext_id`.** It's your reference id on `/webapi`. Keeping it
  stable across attempts means a repeat can be reconciled against what you already sent
  (see Step 4).
- **Push server API — send an `Idempotency-Key` header** (≤120 chars) on write calls.
  Repeating the same key returns the **original** response instead of acting twice:

  ```
  Idempotency-Key: send-987-once
  ```

Generate the key/`ext_id` **before** the first attempt and reuse it for every retry of that
same logical operation.

---

## Step 4 — The golden rule: after a send timeout, check status — don't resend

A timeout is the dangerous case. Your request timed out, but the message may already be
**queued and billed** server-side. If you just fire it again, you've sent — and paid for —
two messages.

Do this instead:

1. **Look up the status by `ext_id`** with
   [`GET /getstatus?ext_id=...`](../reference/status.md).
2. If it returns a row (any status — `Waiting`, `Sent`, `Delivered`…), the message **did**
   land. Do **not** resend.
3. Only if `/getstatus` returns `404 Messages not found` did the send truly fail — now it's
   safe to resend, reusing the same `ext_id`.

```bash
# after a /webapi timeout for ext_id "camp42-1001":
curl 'https://portal.pushfy.com/getstatus?ext_id=camp42-1001' \
  -H 'Authorization: Bearer YOUR_API_TOKEN'
# 200 + a row  -> it exists, DON'T resend
# 404          -> it never landed, safe to resend with the same ext_id
```

For the Push server API, the equivalent safety net is the `Idempotency-Key`: replay the
same call with the same key and you get the original result, not a second send.

---

## Step 5 — A retry wrapper (pseudo-code)

This wrapper backs off on transient failures, respects the golden rule on timeouts, and
never resends a message that already exists.

```python
import time, random

RETRYABLE_HTTP = {429, 500, 503}

def send_with_retry(ext_id, payload, max_attempts=5):
    for attempt in range(max_attempts):
        try:
            resp = http_post("/webapi", json={"messages": [payload]})  # payload carries ext_id
        except (Timeout, ConnectionError):
            # GOLDEN RULE: a send may have succeeded. Verify before resending.
            if message_exists(ext_id):
                return "already_sent"        # do NOT resend — avoids a duplicate charge
            backoff(attempt); continue       # truly failed -> safe to retry same ext_id

        if resp.status == 200:
            return resp.json()               # array, one row per message
        if resp.status in RETRYABLE_HTTP:
            backoff(attempt); continue       # 5xx / 429 -> retry with backoff
        raise ApiError(resp)                 # 4xx you caused -> fix it, don't retry

    raise ApiError("exhausted retries")

def message_exists(ext_id):
    r = http_get(f"/getstatus?ext_id={ext_id}")
    return r.status == 200                    # 404 = never landed

def backoff(attempt):
    delay = (2 ** attempt) + random.uniform(0, 0.5)   # 1s, 2s, 4s… + jitter
    time.sleep(delay)
```

The same skeleton works for the Push server API — swap `message_exists` for an
`Idempotency-Key` on the write call, and branch on `{"ok": false, "error": ...}` instead of
the classic `{"error": ...}`.

---

## Rate limits at a glance

| API | Scope | Limit |
|---|---|---|
| PushAgent | per IP / per account | 300 / 60s |
| Push | per SDK IP | 600 / 60s |
| Push | per public app | 1200 / 60s |
| Push | per account (HMAC) | 600 / 60s |

Exceeding a limit returns `429` with `{ "ok": false, "error": "rate_limited" }`. See
[Errors & rate limits](../reference/errors.md).

---

## Next steps

- [Errors & rate limits](../reference/errors.md) — the complete error catalog.
- [Delivery status](../reference/status.md) — the `/getstatus` lookup used in Step 4.
- [Receiving webhooks](./receiving-webhooks.md) — get pushed outcomes instead of polling.
