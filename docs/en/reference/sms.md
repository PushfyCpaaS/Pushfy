# Send SMS

Send one or many text messages in a single request.

- **URL** — `https://portal.pushfy.com/webapi`
- **Method** — `POST`
- **Auth** — Bearer token ([Authentication](./authentication.md))
- **Content-Type** — `application/json` (required)

`/webapi` queues the messages and returns immediately (recommended for volume). A synchronous
variant, `POST /api`, has the same request/response shape but writes messages inline.

## Headers

```
Authorization: Bearer YOUR_API_TOKEN
Content-Type: application/json
```

## Body

| Field | Type | Required | Description |
|---|---|---|---|
| `messages` | array | ✅ | One or more messages (up to 100,000 per request) |
| `messages[].destinations` | array | ✅ | Recipient list — **only the first entry is used** |
| `messages[].destinations[].to` | string | ✅ | Phone number, digits only, country code first (e.g. `5511999999999`). Min 8 digits |
| `messages[].text` | string | ✅ | Message body (up to 10,000 chars; longer is truncated) |
| `messages[].ext_id` | string | — | Your own reference id, echoed back and used for status lookups. Auto-generated if omitted |
| `messages[].audio` | string | — | Audio id — turns this message into a **voice call** ([Send Voice](./voice.md)) |

## Request

```bash
curl -X POST 'https://portal.pushfy.com/webapi' \
  -H 'Authorization: Bearer YOUR_API_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "messages": [
      {
        "ext_id": "order-1042",
        "destinations": [{ "to": "5511999999999" }],
        "text": "Your order #1042 has shipped 🚚"
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

## Bulk send

Pass multiple objects in `messages`. Each is independent and returns its own row.

```bash
curl -X POST 'https://portal.pushfy.com/webapi' \
  -H 'Authorization: Bearer YOUR_API_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "messages": [
      { "ext_id": "b1", "destinations": [{ "to": "5511999990001" }], "text": "Hi Ana" },
      { "ext_id": "b2", "destinations": [{ "to": "5511999990002" }], "text": "Hi Bruno" }
    ]
  }'
```

See the [Bulk sending guide](../guides/bulk-sending.md) for batching tens of thousands of messages.

## Errors

| HTTP | Body | Cause |
|---|---|---|
| 400 | `invalid_json` | Body isn't valid JSON |
| 400 | `invalid_payload` / `empty` | `messages` missing or empty |
| 400 | `max_100000` | More than 100,000 messages in one request |
| 401 | `unauthorized` | Missing/invalid token |
| 403 | `ip_not_allowed` | Caller IP not in your account allow-list |
| 405 | `method_not_allowed` | Use `POST` |
| 413 | `payload_too_large` | Request body exceeds the size limit |
| 415 | `invalid_content_type` | Missing `Content-Type: application/json` |
| 500 | `db_error` / `insert_error` | Temporary server error — safe to retry |

See [Errors & rate limits](./errors.md) and the [Retry guide](../guides/error-handling.md).

## Notes

- **Async by design.** `/webapi` accepts and queues; delivery happens shortly after. Track outcome
  via [status endpoints](./status.md) or [status webhooks](../webhooks/messaging-status.md).
- **Phone format.** Digits only, country code first. Non-digits are stripped automatically.
- **One recipient per message.** Only `destinations[0].to` is used; add more objects to `messages`
  for more recipients.
- **Long messages.** Messages over 160 characters are sent as multiple segments and billed per
  segment (1 segment per ~157 chars).
- **Sender id.** The sender/brand is fixed per account; a `from` field is ignored.
