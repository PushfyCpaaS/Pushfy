# Errors & rate limits

How the Pushfy API reports failures, the codes you can expect, and how to retry safely.

## Two error formats

Pushfy spans two generations of API. They report errors differently, so check which one you're calling.

**Messaging (classic API)** — most endpoints answer with a JSON object:

```json
{ "error": "unauthorized" }
```

A few **status endpoints answer with plain text** instead of JSON (e.g. `Unauthorized`,
`Messages not found`, `id parameter is missing`). Don't assume every messaging response is JSON —
read the `Content-Type` or fall back to the raw body on non-`200`.

**V2 API (Push / PushAgent)** — always a JSON object with an `ok` flag:

```json
{ "ok": false, "error": "rate_limited" }
```

On success V2 returns `"ok": true`; on failure `"ok": false` plus an `error` string.

## HTTP status codes

| HTTP | Meaning |
|---|---|
| `200` | OK |
| `204` | No content (CORS preflight) |
| `400` | Invalid request |
| `401` | Unauthorized |
| `403` | Forbidden (`ip_not_allowed` / `produto_inativo` / origin not authorized) |
| `404` | Not found |
| `405` | Method not allowed |
| `413` | Payload too large |
| `415` | Invalid content type |
| `429` | Rate limited |
| `500` | Internal error |
| `503` | Overloaded — temporary, retry later |

## Error strings — Messaging

| String | HTTP | Meaning | What to do |
|---|---|---|---|
| `unauthorized` | 401 | Missing or invalid token | Check your Bearer token ([Authentication](./authentication.md)) |
| `ip_not_allowed` | 403 | Caller IP not in your allow-list | Add the IP, or call from an allowed host |
| `method_not_allowed` | 405 | Wrong HTTP method | Use `POST` |
| `invalid_content_type` | 415 | Missing/wrong content type | Send `Content-Type: application/json` |
| `payload_too_large` | 413 | Body exceeds the size limit | Split into smaller batches |
| `invalid_json` | 400 | Body isn't valid JSON | Fix the JSON |
| `invalid_payload` / `empty` | 400 | `messages` missing or empty | Include at least one message |
| `max_100000` | 400 | More than 100,000 messages in one request | Batch under the limit |
| `rcs_campaign_not_found` | 400 | Referenced RCS campaign doesn't exist | Check the campaign id |
| `cid_required` | 400 | Campaign id missing | Provide `cid` |
| `invalid_campaign` | 403 | Campaign not owned by this account | Use a campaign you own |
| `db_error` / `insert_error` | 500 | Temporary server error | Safe to retry with backoff |

### Status endpoints (plain text)

| Body | HTTP | Meaning | What to do |
|---|---|---|---|
| `Unauthorized` | 401 | Missing or invalid token | Check your token |
| `id parameter is missing` | 400 | Required `id` not supplied | Pass the message/`ext_id` |
| `date parameter is missing` | 400 | Required `date` not supplied | Pass the `date` |
| `Messages not found` | 404 | No messages match the query | Verify the id/date |

## Error strings — V2 (Push / PushAgent)

| String | HTTP | Meaning | What to do |
|---|---|---|---|
| `unauthorized` | 401 | Missing header, bad signature, or timestamp outside the window | Re-sign the request ([Authentication](./authentication.md)) |
| `produto_inativo` | 403 | Product not enabled on your account | Enable it in the dashboard |
| `rate_limited` | 429 | Too many requests | Back off and retry (see below) |
| `rota` / `rota_desconhecida` / `nao_encontrada` | 404 | Unknown route | Check the `r` path |
| `metodo` | 405 | Wrong HTTP method | Use the documented method |
| `internal` | 500 | Server error | Retry with backoff |

V2 also returns `400` with the **field name** as the error string when a required field is missing
or invalid — for example `app_id`, `token`, `user_ext_id`, `content`, `type`, `run_at`, `name`.

## Rate limits

| API | Scope | Limit |
|---|---|---|
| **PushAgent API** | Per IP (pre-auth) | 300 / 60s |
| | Per account | 300 / 60s |
| **Push API** | Per SDK IP | 600 / 60s |
| | Per public app | 1200 / 60s |
| | Per account (HMAC) | 600 / 60s |

When you exceed a limit the API responds:

```
HTTP 429
{ "ok": false, "error": "rate_limited" }
```

Use **exponential backoff** — wait, then retry with a growing delay (e.g. 1s, 2s, 4s, 8s…) plus a
little random jitter. Don't retry in a tight loop.

## Best practices

- **Retry `5xx` and timeouts** with an **idempotent** retry. Reuse the same `ext_id` (messaging) or
  `Idempotency-Key` (Push server API) so a repeated call can't create a duplicate.
- **Respect `429`.** Stop, back off exponentially, then resume.
- **Never blindly resend after a send timeout** — the request may have succeeded server-side, so a
  blind resend risks a **duplicate charge**. Instead, [look up the status](./status.md) by
  `ext_id` and only resend if it truly didn't land.

See the [Retry & error-handling guide](../guides/error-handling.md) for worked examples.

## Delivery status glossary (messaging)

These are outcomes reported by [status endpoints](./status.md) and
[status webhooks](../webhooks/messaging-status.md), not request errors:

| Status | Meaning |
|---|---|
| `Sent` | Handed off to the carrier |
| `Delivered` | Confirmed delivered to the device |
| `Undelivered` | Carrier could not deliver |
| `Expired` | Validity window elapsed before delivery |
| `Invalid` | Invalid destination number |
| `Blocked` | Recipient/number is blocked |
| `No credits` | Account had no balance for this message |
| `Rejected` | Rejected by carrier or platform |
| `Duplicate` | Detected as a duplicate |
| `Characters Exceeded` | Message body over the allowed length |
| `Strike` | Suppressed by Strike optimization |
| `Clicked` | Recipient clicked a tracked link |
| `Releasing` | Being released to the carrier |
| `Waiting` | Queued, awaiting dispatch |

### Voice-only statuses

| Status | Meaning |
|---|---|
| `Called` | Call placed |
| `Answered` | Call answered |
| `Not Answered` | No answer |
| `Invalid audio` | Audio id invalid or unusable |
| `Fail` | Call failed |

## Next steps

- [Authentication](./authentication.md)
- [Check delivery status](./status.md)
- [Webhooks](../webhooks/README.md)
