# Create a campaign

Campaigns send one message to many people from your server. This guide focuses on **Push
Notification campaigns** — created, sent, and measured through the HMAC-signed server API —
and then shows, briefly, how to run an **RCS campaign** on the Messaging side.

You'll create a campaign, send it, read its metrics, and learn how to **schedule** a send
and target **segments**.

---

## Before you start

For Push campaigns you need:

- Push Notifications enabled on your account.
- A **server** API key pair from **Settings → API Keys**: a `pushk_` key id and its
  `pss_` secret. The secret is shown **only once** — store it securely.
- Devices already registered against your `app_id` (your front-end SDK does this). See
  [Push Notifications](../reference/push.md).

Push server calls are signed with **HMAC-SHA256**. Every request carries three headers —
`X-PUSH-Key`, `X-PUSH-Timestamp`, `X-PUSH-Signature` — and the signature covers the
timestamp, method, path, and a hash of the body. The full recipe is in
[Authentication → signing recipe](../reference/authentication.md#signing-recipe).

> The examples below build the signature inline with `openssl` so each step is a
> self-contained, runnable command. In production, sign in your application code.

---

## Step 1 — Create the campaign

`POST /v1/push/campaigns`. Only `name` is required; everything else shapes the
notification and its audience.

Useful fields:

| Field | Purpose |
|---|---|
| `name` | Internal campaign name (required) |
| `title` / `body` | Notification title and text |
| `url` | Click-through URL |
| `image` / `icon` | Hero image / icon |
| `audience` | Targeting — a segment id, `tags`, or a filter |
| `schedule_at` | ISO time to send later; omit to send on demand |

```bash
BODY='{"name":"Weekend promo","title":"50% off today","body":"Tap to claim your bonus","url":"https://example.com/promo","audience":{"tags":["vip"]}}'
TS=$(date +%s)
BH=$(printf '%s' "$BODY" | openssl dgst -sha256 -hex | awk '{print $2}')
BASE=$(printf '%s\n%s\n%s\n%s' "$TS" "POST" "/v1/push/campaigns" "$BH")
SIG=$(printf '%s' "$BASE" | openssl dgst -sha256 -hmac 'pss_YOUR_SECRET' -hex | awk '{print $2}')

curl -X POST 'https://portal.pushfy.com/v2/api.php?r=/v1/push/campaigns' \
  -H "X-PUSH-Key: pushk_YOUR_KEY" \
  -H "X-PUSH-Timestamp: $TS" \
  -H "X-PUSH-Signature: $SIG" \
  -H 'Content-Type: application/json' \
  -d "$BODY"
```

Response — the campaign is created as a **draft**:

```json
{ "ok": true, "campaign_id": 987, "status": "draft" }
```

Keep the `campaign_id`; you sign the next two calls with it in the path.

---

## Step 2 — Send it

`POST /v1/push/campaigns/{id}/send`. **Sign the path including the id** — here
`/v1/push/campaigns/987/send`, not the base route. Add an `Idempotency-Key` so a retried
send can't fire twice.

```bash
BODY='{}'
PATH_R='/v1/push/campaigns/987/send'
TS=$(date +%s)
BH=$(printf '%s' "$BODY" | openssl dgst -sha256 -hex | awk '{print $2}')
BASE=$(printf '%s\n%s\n%s\n%s' "$TS" "POST" "$PATH_R" "$BH")
SIG=$(printf '%s' "$BASE" | openssl dgst -sha256 -hmac 'pss_YOUR_SECRET' -hex | awk '{print $2}')

curl -X POST "https://portal.pushfy.com/v2/api.php?r=$PATH_R" \
  -H "X-PUSH-Key: pushk_YOUR_KEY" \
  -H "X-PUSH-Timestamp: $TS" \
  -H "X-PUSH-Signature: $SIG" \
  -H 'Idempotency-Key: send-987-once' \
  -H 'Content-Type: application/json' \
  -d "$BODY"
```

```json
{ "ok": true, "campaign_id": 987, "status": "sending" }
```

The same shape drives the lifecycle actions `.../pause`, `.../resume`, `.../cancel` and
`.../duplicate`.

---

## Step 3 — Read the metrics

`GET /v1/push/campaigns/{id}/metrics`. It's a GET, so the body hash is the hash of the
**empty string**.

```bash
PATH_R='/v1/push/campaigns/987/metrics'
TS=$(date +%s)
BH=$(printf '%s' '' | openssl dgst -sha256 -hex | awk '{print $2}')
BASE=$(printf '%s\n%s\n%s\n%s' "$TS" "GET" "$PATH_R" "$BH")
SIG=$(printf '%s' "$BASE" | openssl dgst -sha256 -hmac 'pss_YOUR_SECRET' -hex | awk '{print $2}')

curl "https://portal.pushfy.com/v2/api.php?r=$PATH_R" \
  -H "X-PUSH-Key: pushk_YOUR_KEY" \
  -H "X-PUSH-Timestamp: $TS" \
  -H "X-PUSH-Signature: $SIG"
```

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

For live event-by-event results, subscribe to the
[Push webhook](../webhooks/push.md) instead of polling metrics.

---

## Scheduling and segments

**Schedule a send** — set `schedule_at` to an ISO time when you create the campaign, and
Pushfy sends it then. Omit `schedule_at` to keep it a draft you fire manually with
`/send`:

```json
{ "name": "Monday digest", "title": "This week's picks", "schedule_at": "2026-07-20T13:00:00Z" }
```

**Target a segment** — point `audience` at a saved segment or a set of tags/filters. Create
segments with `POST /v1/push/segments` (`name` required, optional `filter`) and reference
the returned id:

```json
{ "name": "VIP re-engagement", "audience": { "segment_id": 42 } }
```

You can also target inline with `audience.tags` (as in Step 1) or an ad-hoc
`audience.filter`. See [Push Notifications](../reference/push.md) for the full route list.

---

## Also: an RCS campaign (Messaging)

If your "campaign" is really a batch of rich RCS cards over the Messaging API, the
mechanics are different — Bearer token, not HMAC — and you append messages to a campaign
by id.

Send to an existing campaign with `POST /rcscampaign?cid=<ID>`. `cid` is required and
validated against your account:

```bash
curl -X POST 'https://portal.pushfy.com/rcscampaign?cid=12345' \
  -H 'Authorization: Bearer YOUR_API_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "messages": [
      {
        "ext_id": "promo-1042",
        "destinations": [{ "to": "5511999999999" }],
        "text": "Order #1042 is on its way 🚚"
      }
    ]
  }'
```

The response echoes the `cid` the messages were added to. If you'd rather have the
campaign created for you, use `POST /rcs`; if it's already provisioned as an "API RCS"
campaign, use `POST /apircsnativo.php`. All three are covered in
[Send RCS](../reference/rcs.md).

---

## Next steps

- Wire up delivery/click events with the [Push webhook](../webhooks/push.md) — see the
  [Receiving webhooks guide](./receiving-webhooks.md).
- Sign requests correctly — [Authentication](../reference/authentication.md).
- Handle failures and retries safely — [Handling errors](./error-handling.md).
