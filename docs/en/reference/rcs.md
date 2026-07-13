# Send RCS

Send one or many RCS rich cards (title, image, text, link button) in a single request.

- **URL** — `https://portal.pushfy.com/apircsnativo.php`
- **Method** — `POST`
- **Auth** — Bearer token ([Authentication](./authentication.md))
- **Content-Type** — `application/json` (required)

`/apircsnativo.php` queues RCS cards against an existing **"API RCS"** campaign on your account
(recommended). If the account has no such campaign provisioned yet, the call returns
`400 {"error":"rcs_campaign_not_found"}` — see [Variants](#variants) for endpoints that create the
campaign for you.

## Headers

```
Authorization: Bearer YOUR_API_TOKEN
Content-Type: application/json
```

## Body

| Field | Type | Required | Description |
|---|---|---|---|
| `messages` | array | ✅ | One or more RCS cards |
| `messages[].destinations` | array | ✅ | Recipient list — **only the first entry is used** |
| `messages[].destinations[].to` | string | ✅ | Phone number, digits only, country code first (e.g. `5511999999999`) |
| `messages[].text` | string | ✅ | Card body text |
| `messages[].title` | string | — | Card title (header) |
| `messages[].image` | string | — | Image URL shown at the top of the card |
| `messages[].url` | string | — | Destination link opened by the button |
| `messages[].cta` | string | — | Button label (call to action) |
| `messages[].ext_id` | string | — | Your own reference id, echoed back and used for status lookups. Auto-generated if omitted |

## Request

```bash
curl -X POST 'https://portal.pushfy.com/apircsnativo.php' \
  -H 'Authorization: Bearer YOUR_API_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "messages": [
      {
        "ext_id": "order-1042",
        "destinations": [{ "to": "5511999999999" }],
        "title": "Your order shipped",
        "image": "https://cdn.example.com/box.png",
        "text": "Order #1042 is on its way 🚚",
        "url": "https://shop.example.com/orders/1042",
        "cta": "Track order"
      }
    ]
  }'
```

## Response

`200 OK` — an **array** with one object per message:

```json
[
  {
    "id": "order-1042",
    "phone": "5511999999999",
    "date": "2026-07-12 14:33:21",
    "ext_id": "order-1042"
  }
]
```

Store `ext_id` to [check delivery status](./status.md) later.

## Variants

### Auto-create the campaign — `POST /rcs`

The simplest option: it **creates the campaign automatically**, so no provisioning is needed. Here
`to` is passed directly on each message (not inside `destinations`).

```bash
curl -X POST 'https://portal.pushfy.com/rcs' \
  -H 'Authorization: Bearer YOUR_API_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "messages": [
      {
        "to": "5511999999999",
        "title": "Your order shipped",
        "text": "Order #1042 is on its way 🚚",
        "url": "https://shop.example.com/orders/1042",
        "cta": "Track order",
        "image": "https://cdn.example.com/box.png"
      }
    ]
  }'
```

Response:

```json
{ "status": "ok", "campaign_id": 12345, "inserted": 8 }
```

### Send to an existing campaign — `POST /rcscampaign?cid=<ID>`

Targets a campaign you already own. `cid` is required and validated against your account. Messages
use `destinations[].to` plus `text` and an optional `ext_id`.

```bash
curl -X POST 'https://portal.pushfy.com/rcscampaign?cid=12345' \
  -H 'Authorization: Bearer YOUR_API_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "messages": [
      {
        "ext_id": "order-1042",
        "destinations": [{ "to": "5511999999999" }],
        "text": "Order #1042 is on its way 🚚"
      }
    ]
  }'
```

The response includes the `cid` of the campaign the messages were added to.

## Errors

| HTTP | Body | Cause |
|---|---|---|
| 400 | `rcs_campaign_not_found` | `apircsnativo.php` — no **"API RCS"** campaign provisioned on the account |
| 400 | `cid_required` | `rcscampaign` — `cid` query parameter missing |
| 401 | `unauthorized` | Missing/invalid token |
| 403 | `ip_not_allowed` | Caller IP not in your account allow-list |
| 403 | `invalid_campaign` | `rcscampaign` — `cid` does not belong to your account |

See [Errors & rate limits](./errors.md) and the [Retry guide](../guides/error-handling.md).

## Notes

- **Field aliases (Portuguese).** The server also accepts these aliases for the card fields:
  `titulo` (title); `texto` / `body` / `mensagem` (text); `imagem` / `image_url` / `img` (image);
  `link` / `destino` (url); `botao` / `button` / `label` (cta). Prefer the separated English fields
  above for clarity.
- **One recipient per message.** Only `destinations[0].to` is used (or the message-level `to` on
  `/rcs`); add more objects to `messages` for more recipients.
- **`/rcs` caveats.** The `image_data` and `id` fields are ignored, and there is **no
  deduplication** — sending the same recipient twice inserts two cards.
- **Phone format.** Digits only, country code first.
- **Which endpoint.** Use `apircsnativo.php` when your "API RCS" campaign is already provisioned;
  use `/rcs` to have it created for you; use `/rcscampaign?cid=` to append to a specific campaign.
