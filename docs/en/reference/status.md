# Delivery status

Check whether your messages were delivered. There are three ways to query — by message,
by day, or by period — plus a helper to list blocked numbers.

- **Base URL** — `https://portal.pushfy.com`
- **Method** — `GET`
- **Auth** — Bearer token or Basic ([Authentication](./authentication.md))

There is no "by campaign" lookup. To pull a whole send, query by day or by period.

## Headers

```
Authorization: Bearer YOUR_API_TOKEN
```

Basic auth (`login:password`) is also accepted.

## 1. By message — `/getstatus`

Look up one message by the `ext_id` you sent it with (or by the internal `uid`).

| Param | Required | Description |
|---|---|---|
| `ext_id` | ✅ | Your own reference id, as sent with the message |
| `uid` | — | Internal message id (alternative to `ext_id`) |

### Request

```bash
curl 'https://portal.pushfy.com/getstatus?ext_id=YOUR_EXT_ID' \
  -H 'Authorization: Bearer YOUR_API_TOKEN'
```

### Response

`200 OK` — an **array** with one object per matching message:

```json
[
  {
    "phone": "5511999999999",
    "status": "Delivered",
    "date": "2026-07-12 14:33:21",
    "channel": "SMS",
    "statustvoz": "Answered"
  }
]
```

- `status` — see the [status glossary](#status-glossary) below.
- `channel` — `SMS`, `RCS`, or `TVOZ` (voice).
- `statustvoz` — voice call result; only meaningful when `channel` is `TVOZ`.

### Errors

| HTTP | Body | Cause |
|---|---|---|
| 400 | `id parameter is missing` | Neither `ext_id` nor `uid` was supplied |
| 401 | `Unauthorized` | Missing/invalid credentials |
| 404 | `Messages not found` | No message matches the id |
| 503 | — | Temporarily throttled under load — retry with backoff |

Error bodies are plain text.

## 2. By day — `/getdate`

Return the status of every message on a given date.

| Param | Required | Description |
|---|---|---|
| `date` | ✅ | Day to report, `YYYY-MM-DD` |

### Request

```bash
curl 'https://portal.pushfy.com/getdate?date=2026-07-12' \
  -H 'Authorization: Bearer YOUR_API_TOKEN'
```

### Response

`200 OK` — an **array**, one object per message:

```json
[
  {
    "phone": "5511999999999",
    "status": "Delivered",
    "date": "2026-07-12 14:33:21",
    "date_dlr": "2026-07-12 14:33:40",
    "ext_id": "order-1042",
    "channel": "SMS",
    "brand": "YOUR_BRAND"
  }
]
```

`date_dlr` is when the carrier delivery receipt (DLR) arrived.

### Errors

| HTTP | Body | Cause |
|---|---|---|
| 400 | `date parameter is missing` | No `date` supplied |
| 400 | `invalid date format (YYYY-MM-DD required)` | Wrong format |
| 400 | `invalid date value` | Format ok, but not a real date |
| 404 | `Messages not found` | No messages on that day |

## 3. By period — `/reportbydate`

Paginated report over a day or a datetime range, with optional filters.

| Param | Required | Description |
|---|---|---|
| `date` | — | A single day, `YYYY-MM-DD` |
| `start` | — | Range start, datetime — **takes precedence** over `date` |
| `end` | — | Range end, datetime — **takes precedence** over `date` |
| `date_dlr` | — | Filter by delivery-receipt date |
| `event` | — | Filter by status (English name, see glossary) |
| `limit` | — | Max rows, up to `5000` (default `1000`) |
| `offset` | — | Rows to skip, for pagination |

Pass either `date` or `start`+`end`. When both are present, `start`+`end` win.

### Request

```bash
curl 'https://portal.pushfy.com/reportbydate?start=2026-07-12+00:00:00&end=2026-07-12+23:59:59&event=Delivered&limit=1000' \
  -H 'Authorization: Bearer YOUR_API_TOKEN'
```

### Response

`200 OK` — an **array**, one object per message:

```json
[
  {
    "id": "123456",
    "timestamp": "2026-07-12 14:33:21",
    "date_dlr": "2026-07-12 14:33:40",
    "event": "Delivered",
    "recipient": "5511999999999",
    "label": "order-1042",
    "message": "Your order #1042 has shipped",
    "channel": "SMS",
    "status_code": "0",
    "cost": "0.06"
  }
]
```

`channel` here is `SMS`, `VOICE`, `RCS`, or `WHATSAPP`. Page with `limit`/`offset`.

## Status glossary

Possible values of `status` / `event`:

| Value | Meaning |
|---|---|
| `Waiting` | Queued, not yet dispatched |
| `Sent` | Handed to the carrier |
| `Releasing` | In transit to the carrier |
| `Delivered` | Confirmed delivered to the handset |
| `Clicked` | Recipient clicked a tracked link |
| `Undelivered` | Carrier reported non-delivery |
| `Expired` | Validity window elapsed before delivery |
| `Rejected` | Rejected by the carrier |
| `Invalid` | Invalid number |
| `Blocked` | Number is on your block list |
| `Duplicate` | Filtered as a duplicate |
| `Characters Exceeded` | Body over the allowed length |
| `Strike` | Suppressed by strike protection (repeatedly undelivered) |
| `No credits` | Insufficient balance |

### Voice status (`statustvoz`)

For voice calls only:

| Value | Meaning |
|---|---|
| `Waiting` | Queued |
| `Called` | Call placed |
| `Answered` | Call answered |
| `Not Answered` | Call not answered |
| `Invalid audio` | Audio could not be played |
| `Fail` | Call failed |

## Blocked numbers — `/strikeapi`

List numbers currently blocked by strike protection.

```bash
curl 'https://portal.pushfy.com/strikeapi' \
  -H 'Authorization: Bearer YOUR_API_TOKEN'
```

`200 OK` — an **array**:

```json
[
  {
    "phone_number": "5511999999999",
    "block_reason": "repeated_undelivered",
    "undelivered_total": 5,
    "blocked_at": "2026-07-01 09:15:00"
  }
]
```

## Notes

- **Keep your `ext_id`.** Storing your own reference id at send time makes `/getstatus` the
  fastest lookup. See [Send SMS](./sms.md).
- **Statuses are eventual.** A message may sit in `Waiting`/`Sent` before a `Delivered` DLR
  arrives; poll again, or use [status webhooks](../webhooks/messaging-status.md) to be pushed
  updates instead of polling.
- **Under load, `/getstatus` may return `503`.** Retry with exponential backoff.
- **Pagination.** `/reportbydate` caps at `5000` rows per page; page with `limit`/`offset`.

See [Errors & rate limits](./errors.md).
