# Push Notifications

Web and native push: register devices from the browser/app, then create and send
campaigns from your server.

All Push routes share the prefix `/v1/push` and are reached through the API gateway:

```
https://portal.pushfy.com/v2/api.php?r=<route>
```

## Two authentication groups

The Push API is split into two groups that live under the same prefix but authenticate differently.

| Group | Who calls it | Auth | CORS |
|---|---|---|---|
| **Public (device SDK)** | Browser / mobile app | Public `app_id` (body or `?app_id=`) | Open |
| **Server** | Your backend | HMAC (`X-PUSH-*` headers) | n/a (server-to-server) |

- **Public group** — `config`, `subscribe`, `unsubscribe`, `track`. Safe to ship in front-end
  code: the only credential is your **public** `app_id`. No signature. See
  [Authentication → public `app_id`](./authentication.md).
- **Server group** — everything else (devices, campaigns, segments, events, reports, webhooks,
  test). Signed with HMAC-SHA256 using a `pushk_` key + `pss_` secret. See
  [Authentication → HMAC](./authentication.md).

> Never expose an HMAC secret in a browser or mobile app. The public `app_id` is the only
> credential meant for client devices.

---

## Typical flow

**Front-end (device SDK)**

1. `GET /v1/push/config` — fetch the VAPID public key and opt-in settings for your `app_id`.
2. `POST /v1/push/subscribe` — register the device's push subscription (or native token).
3. `POST /v1/push/track` — report `delivered` / `open` / `click` / `conversion` events.

**Back-end (server API)**

1. `POST /v1/push/campaigns` — create a campaign.
2. `POST /v1/push/campaigns/{id}/send` — send it.
3. `GET /v1/push/campaigns/{id}/metrics` — read delivery, open, click and conversion counts.

---

## Routes

### Public — device SDK (`app_id`)

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/v1/push/config` | VAPID public key + opt-in settings |
| `POST` | `/v1/push/subscribe` | Register a device |
| `POST` | `/v1/push/unsubscribe` | Opt a device out |
| `POST` | `/v1/push/track` | Report a device-side event |

### Server — HMAC (`X-PUSH-*`)

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/v1/push/devices` | List devices (filters `status`, `platform`, `limit`) |
| `POST` | `/v1/push/devices` | Register a device server-side |
| `DELETE` | `/v1/push/devices/{id}` | Delete a device |
| `GET` | `/v1/push/campaigns` | List campaigns |
| `POST` | `/v1/push/campaigns` | Create a campaign |
| `GET` | `/v1/push/campaigns/{id}` | Get a campaign |
| `PATCH` | `/v1/push/campaigns/{id}` | Update a draft campaign |
| `POST` | `/v1/push/campaigns/{id}/send` | Send a campaign |
| `POST` | `/v1/push/campaigns/{id}/pause` | Pause |
| `POST` | `/v1/push/campaigns/{id}/resume` | Resume |
| `POST` | `/v1/push/campaigns/{id}/cancel` | Cancel |
| `POST` | `/v1/push/campaigns/{id}/duplicate` | Duplicate |
| `GET` | `/v1/push/campaigns/{id}/metrics` | Sent / delivered / opens / clicks / conversions |
| `GET` | `/v1/push/segments` | List segments |
| `POST` | `/v1/push/segments` | Create a segment |
| `POST` | `/v1/push/events` | Ingest events server-side |
| `POST` | `/v1/push/conversions` | Ingest conversions server-side |
| `GET` | `/v1/push/reports` | Aggregated reports (`range`/`de`/`ate`) |
| `GET` | `/v1/push/webhooks` | List webhooks |
| `POST` | `/v1/push/webhooks` | Create a webhook |
| `DELETE` | `/v1/push/webhooks/{id}` | Delete a webhook |
| `POST` | `/v1/push/test` | Send a test push |

---

## Public group — device SDK

Authenticate with your **public** `app_id`. CORS is open, so these run from front-end code.

### `GET /v1/push/config`

Returns the data the browser SDK needs to subscribe.

**Request**

```bash
curl 'https://portal.pushfy.com/v2/api.php?r=/v1/push/config&app_id=pushapp_xxxxxxxxxxxx'
```

**Response** — `200 OK`

```json
{
  "ok": true,
  "app_id": "pushapp_xxxxxxxxxxxx",
  "vapid_public": "BExxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "optin": {
    "prompt": "soft",
    "delay": 5
  }
}
```

**Errors** — `400 app_id` (missing/unknown), `403 produto_inativo`, `404 rota`.

### `POST /v1/push/subscribe`

Register a device. For web push send the browser `subscription`; for native send a `token`.

| Field | Type | Required | Description |
|---|---|---|---|
| `app_id` | string | ✅ | Your public application id |
| `provider` | string | — | `webpush` (default) · `fcm` · `apns` |
| `platform` | string | — | `web` (default) · `android` · `ios` · `safari` |
| `subscription` | object | ✅ if `webpush` | `{ endpoint, keys:{ p256dh, auth } }` |
| `token` | string | ✅ if `fcm`/`apns` | Native push token |
| `user_ext_id` | string | — | Your own user id to link the device |
| `tags` | array | — | Free-form tags for targeting |
| `attrs` | object | — | Custom attributes |
| `context` | object | — | `{ ua, lang, tz, country, pwa }` |

**Request** (web push)

```bash
curl -X POST 'https://portal.pushfy.com/v2/api.php?r=/v1/push/subscribe' \
  -H 'Content-Type: application/json' \
  -d '{
    "app_id": "pushapp_xxxxxxxxxxxx",
    "provider": "webpush",
    "platform": "web",
    "subscription": {
      "endpoint": "https://fcm.googleapis.com/fcm/send/xxxxxxxx",
      "keys": {
        "p256dh": "BExxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        "auth": "xxxxxxxxxxxxxxxxxxxxxx"
      }
    },
    "user_ext_id": "user-42",
    "tags": ["vip", "pt-br"],
    "context": { "lang": "pt-BR", "tz": "America/Sao_Paulo", "pwa": false }
  }'
```

**Response** — `200 OK`

```json
{ "ok": true, "device_id": 123 }
```

**Errors** — `400 app_id` / `400 token` (missing subscription or token), `403 produto_inativo`,
`403 origem_nao_autorizada` (browser `Origin` not in the project allow-list — an **empty** list
allows any origin), `429 rate_limited`.

### `POST /v1/push/unsubscribe`

Opt a device out. Identify it by `token` or by `subscription.endpoint`.

```bash
curl -X POST 'https://portal.pushfy.com/v2/api.php?r=/v1/push/unsubscribe' \
  -H 'Content-Type: application/json' \
  -d '{
    "app_id": "pushapp_xxxxxxxxxxxx",
    "subscription": { "endpoint": "https://fcm.googleapis.com/fcm/send/xxxxxxxx" }
  }'
```

**Response** — `200 OK`

```json
{ "ok": true }
```

**Errors** — `400 app_id`, `400 token` (neither `token` nor `subscription.endpoint` given).

### `POST /v1/push/track`

Report a device-side event.

| Field | Type | Required | Description |
|---|---|---|---|
| `app_id` | string | ✅ | Your public application id |
| `event` | string | ✅ | `delivered` · `open` · `click` · `close` · `conversion` |
| `campaign_id` | number | — | Campaign the event belongs to |
| `delivery_id` | string | — | Per-delivery id from the push payload |
| `value` | number | — | Monetary/other value (for `conversion`) |
| `token` | string | — | Device token/endpoint to attribute the event |
| `meta` | object | — | Free-form metadata |

```bash
curl -X POST 'https://portal.pushfy.com/v2/api.php?r=/v1/push/track' \
  -H 'Content-Type: application/json' \
  -d '{
    "app_id": "pushapp_xxxxxxxxxxxx",
    "event": "click",
    "campaign_id": 987,
    "delivery_id": "d-xxxxxxxx"
  }'
```

**Response** — `200 OK`

```json
{ "ok": true }
```

**Errors** — `400 app_id`, `400 type` (missing/invalid `event`), `429 rate_limited`.

---

## Server group — HMAC

Sign every request with your `pushk_` key and `pss_` secret using the
[signing recipe](./authentication.md#signing-recipe) — identical to the rest of the HMAC API,
with the `X-PUSH-*` headers. Write calls accept an optional `Idempotency-Key` header.

### `POST /v1/push/campaigns`

Create a campaign.

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | ✅ | Internal campaign name |
| `title` | string | — | Notification title |
| `body` | string | — | Notification body |
| `url` | string | — | Click-through URL |
| `icon` | string | — | Icon URL |
| `image` | string | — | Hero image URL |
| `ttl` | number | — | Time-to-live in seconds |
| `priority` | string | — | Delivery priority |
| `audience` | object | — | Targeting (segment id, tags, filter) |
| `schedule_at` | string | — | ISO time to send; omit to send on demand |

**Request**

```bash
BODY='{"name":"Weekend promo","title":"50% off today","body":"Tap to claim your bonus","url":"https://example.com/promo","audience":{"tags":["vip"]}}'
TS=$(date +%s)
BH=$(printf '%s' "$BODY" | openssl dgst -sha256 -hex | awk '{print $2}')
BASE=$(printf '%s\n%s\n%s\n%s' "$TS" "POST" "/v1/push/campaigns" "$BH")
SIG=$(printf '%s' "$BASE" | openssl dgst -sha256 -hmac 'pss_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' -hex | awk '{print $2}')

curl -X POST 'https://portal.pushfy.com/v2/api.php?r=/v1/push/campaigns' \
  -H "X-PUSH-Key: pushk_xxxxxxxxxxxxxxxxxxxx" \
  -H "X-PUSH-Timestamp: $TS" \
  -H "X-PUSH-Signature: $SIG" \
  -H 'Content-Type: application/json' \
  -d "$BODY"
```

**Response** — `200 OK`

```json
{ "ok": true, "campaign_id": 987, "status": "draft" }
```

**Errors** — `400 name` (missing), `401 unauthorized`, `403 produto_inativo`, `429 rate_limited`.

### `POST /v1/push/campaigns/{id}/send`

Send a campaign. Sign the path **including** the id, e.g. `/v1/push/campaigns/987/send`.

```bash
curl -X POST 'https://portal.pushfy.com/v2/api.php?r=/v1/push/campaigns/987/send' \
  -H "X-PUSH-Key: pushk_xxxxxxxxxxxxxxxxxxxx" \
  -H "X-PUSH-Timestamp: $TS" \
  -H "X-PUSH-Signature: $SIG" \
  -H 'Idempotency-Key: send-987-once' \
  -H 'Content-Type: application/json' \
  -d '{}'
```

**Response** — `200 OK`

```json
{ "ok": true, "campaign_id": 987, "status": "sending" }
```

Lifecycle actions share this shape: `POST /v1/push/campaigns/{id}/pause` · `.../resume` ·
`.../cancel` · `.../duplicate`.

**Errors** — `401 unauthorized`, `404 rota` (unknown campaign/action), `405 metodo`,
`429 rate_limited`.

### `GET /v1/push/campaigns/{id}/metrics`

```bash
curl 'https://portal.pushfy.com/v2/api.php?r=/v1/push/campaigns/987/metrics' \
  -H "X-PUSH-Key: pushk_xxxxxxxxxxxxxxxxxxxx" \
  -H "X-PUSH-Timestamp: $TS" \
  -H "X-PUSH-Signature: $SIG"
```

**Response** — `200 OK`

```json
{
  "ok": true,
  "campaign_id": 987,
  "metrics": {
    "sent": 10000,
    "delivered": 9640,
    "opens": 3120,
    "clicks": 870,
    "conversions": 145
  }
}
```

### Devices

- `GET /v1/push/devices` — filters `status`, `platform`, `limit` (max **500**).
- `POST /v1/push/devices` — register server-side. Requires `project_id` **or** `app_id`, and `token`.
- `DELETE /v1/push/devices/{id}` — remove a device.

```bash
curl 'https://portal.pushfy.com/v2/api.php?r=/v1/push/devices&status=active&platform=web&limit=100' \
  -H "X-PUSH-Key: pushk_xxxxxxxxxxxxxxxxxxxx" \
  -H "X-PUSH-Timestamp: $TS" \
  -H "X-PUSH-Signature: $SIG"
```

**Errors** — `400 projeto` (neither `project_id` nor `app_id`), `400 token` (missing on `POST`).

### Segments

- `GET /v1/push/segments` — list segments.
- `POST /v1/push/segments` — create; `name` required, optional `filter`.

**Errors** — `400 name` (missing).

### Events & conversions

- `POST /v1/push/events` — ingest events server-side.
- `POST /v1/push/conversions` — ingest conversions server-side.

### Reports

- `GET /v1/push/reports` — aggregated stats. Query with `range`, or `de` + `ate` (dates).

### Webhooks

- `GET /v1/push/webhooks` — list.
- `POST /v1/push/webhooks` — create.
- `DELETE /v1/push/webhooks/{id}` — remove.

See [Push webhooks](../webhooks/push.md) for event payloads and signature verification.

### Test push

- `POST /v1/push/test` — send a quick test. Fields: `project_id`, `title`, `body`, `url`, `limit`.

---

## Errors

Shared across Push routes:

| HTTP | Body | Cause |
|---|---|---|
| 400 | `app_id` / `token` / `name` / `type` / `projeto` | Missing or invalid required field |
| 401 | `unauthorized` | Missing header, bad HMAC signature, or timestamp outside the ±300s window |
| 403 | `produto_inativo` | Push isn't enabled on your account |
| 403 | `origem_nao_autorizada` | Browser `Origin` not in the project allow-list (subscribe) |
| 404 | `rota` | Unknown route/resource |
| 405 | `metodo` | Wrong HTTP method for the route |
| 429 | `rate_limited` | Rate limit exceeded — see below |

**Rate limits**

| Scope | Limit |
|---|---|
| Per SDK IP (public group) | 600 / 60s |
| Per public app (public group) | 1200 / 60s |
| Per account (HMAC / server group) | 600 / 60s |

See [Errors & rate limits](./errors.md).

---

## Next steps

- [Authentication](./authentication.md)
- [Push webhooks](../webhooks/push.md)
- [Errors & rate limits](./errors.md)
