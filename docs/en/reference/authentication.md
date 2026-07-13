# Authentication

Every Pushfy API request must be authenticated. Which scheme you use depends on the product.

| Product | Scheme | Where |
|---|---|---|
| **Messaging** (SMS/RCS/Voice, status, balance) | **Bearer token** | `Authorization` header |
| **Push Notifications** — device/browser calls | **Public app id** | `app_id` in body/query |
| **Push Notifications** — server calls | **HMAC** | `X-PUSH-*` headers |
| **Conversational AI** (PushAgent) | **HMAC** | `X-PA-*` headers |

Keep credentials **server-side**. Never ship a messaging token or HMAC secret in a browser or mobile app (the public `app_id` is the only credential meant for client devices).

---

## 1. Messaging — Bearer token

Get your token in the dashboard: **Settings → API Tokens**.

Send it on every messaging request:

```
Authorization: Bearer YOUR_API_TOKEN
```

Two alternatives are accepted for convenience:

```
X-API-TOKEN: YOUR_API_TOKEN
```
```
Authorization: Basic base64(login:password)   # your Pushfy account login + password
```

**Example**

```bash
curl -X POST 'https://portal.pushfy.com/webapi' \
  -H 'Authorization: Bearer YOUR_API_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"destinations":[{"to":"5511999999999"}],"text":"Hi"}]}'
```

**Errors**

| HTTP | Body | Meaning |
|---|---|---|
| 401 | `unauthorized` | Missing or invalid token |
| 403 | `ip_not_allowed` | Your account has an IP allow-list and the caller IP isn't on it |

> **IP allow-list (optional).** If your account restricts API access by IP, requests from other
> IPs are rejected with `403`. Manage the list with your account manager.

---

## 2. Push Notifications — public `app_id`

Browser/device SDK calls (`/v1/push/config`, `subscribe`, `unsubscribe`, `track`) authenticate
with your **public** application id — safe to expose in front-end code.

```bash
curl 'https://portal.pushfy.com/v2/api.php?r=/v1/push/config&app_id=pushapp_xxxxxxxxxxxx'
```

For `subscribe`, if your project defines an allowed-origins list, the browser `Origin` must match
it (empty list = any origin allowed).

---

## 3. HMAC (Push server API & Conversational AI)

Server-to-server calls are signed with HMAC-SHA256 so the secret never travels on the wire.

**Credentials** (dashboard → **Settings → API Keys**):

| Product | Key header | Timestamp header | Signature header | Key format | Secret format |
|---|---|---|---|---|---|
| PushAgent | `X-PA-Key` | `X-PA-Timestamp` | `X-PA-Signature` | `pak_` + 20 hex | `pas_` + 48 hex |
| Push (server) | `X-PUSH-Key` | `X-PUSH-Timestamp` | `X-PUSH-Signature` | `pushk_` + 20 hex | `pss_` + 48 hex |

The **secret is shown only once** when you create the key. Store it securely.

### Signing recipe

Build a canonical string and HMAC-SHA256 it with your secret:

```
timestamp = current Unix time in seconds
body_hash = sha256_hex(raw_request_body)      # for GET/empty body, sha256_hex("")
base      = timestamp + "\n" + METHOD + "\n" + path + "\n" + body_hash
signature = hmac_sha256_hex(base, secret)
```

- `METHOD` is upper-case (`GET`, `POST`, …).
- `path` is the route only — e.g. `/v1/conversations` — **without** the query string.
- `body` is the exact raw request body.
- The server accepts a **±300 second** timestamp window (protects against replay).

### Example (PushAgent, Python)

```python
import hashlib, hmac, time, requests

KEY_ID = "pak_xxxxxxxxxxxxxxxxxxxx"
SECRET = "pas_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
method, path = "POST", "/v1/conversations"
body = '{"user_ext_id":"user-42","name":"Ana"}'

ts   = str(int(time.time()))
bh   = hashlib.sha256(body.encode()).hexdigest()
base = f"{ts}\n{method}\n{path}\n{bh}"
sig  = hmac.new(SECRET.encode(), base.encode(), hashlib.sha256).hexdigest()

r = requests.post("https://portal.pushfy.com/v2/api.php", params={"r": path}, data=body,
    headers={"X-PA-Key": KEY_ID, "X-PA-Timestamp": ts, "X-PA-Signature": sig,
             "Content-Type": "application/json"})
print(r.json())   # {"ok": true, "conversation_id": 123, "status": "bot"}
```

For the Push server API, use the same recipe with the `X-PUSH-*` headers and your `pushk_`/`pss_` credentials.

**Errors**

| HTTP | Body | Meaning |
|---|---|---|
| 401 | `unauthorized` | Missing header, bad signature, or timestamp outside the 300s window |
| 403 | `produto_inativo` | The product isn't enabled on your account |
| 429 | `rate_limited` | Too many requests — see [Errors & rate limits](./errors.md) |

> **Idempotency (Push server API).** Send an `Idempotency-Key` header (≤120 chars) on write calls;
> repeating the same key returns the original response instead of acting twice.

---

## Next steps

- [Send your first SMS](./sms.md)
- [Errors & rate limits](./errors.md)
- [Webhooks](../webhooks/README.md)
