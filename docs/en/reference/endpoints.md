# Endpoint index

The authoritative list of Pushfy API endpoints, grouped by product. Every entry here is
verified against the live implementation. Where behavior differs from older public docs,
**this document wins**.

> **Base URLs**
> - Messaging & reporting: `https://portal.pushfy.com`
> - Push & Conversational AI: `https://portal.pushfy.com/v2/api.php?r=<route>`

## Messaging (Classic API)

Authentication: `Authorization: Bearer YOUR_API_TOKEN` (also `X-API-TOKEN: YOUR_API_TOKEN`, or HTTP Basic with account login/password). Content type: `application/json`.

| Method | Path | Purpose | Notes |
|---|---|---|---|
| POST | `/webapi` | **Send SMS** (recommended, async/queued) | Body `messages[]`; response is an array `[{id,phone,date,ext_id}]` |
| POST | `/api` | Send SMS (synchronous) | Same body; returns real auto-increment ids |
| POST | `/apircsnativo.php` | **Send RCS** (recommended) | Requires an `API RCS` campaign on the account; supports rich card fields |
| POST | `/rcs` | Send RCS (auto-creates campaign) | Simpler card; response `{status,campaign_id,inserted}` |
| POST | `/rcscampaign?cid=<id>` | Send RCS to a specific campaign | `cid` required and validated as yours |
| POST | `/webapi` (field `audio`) | **Send Voice** | Voice = an SMS message carrying an `audio` id; create audio first via `/audio` |
| POST | `/audio` | Upload a voice audio (`.mp3` only) | `multipart/form-data` (`nome`, `audio`) |
| GET | `/getstatus?ext_id=<id>` | Delivery status of one message | Returns an **array**; also accepts `uid` (internal id) |
| GET | `/getdate?date=YYYY-MM-DD` | Status of all messages on a day | |
| GET | `/reportbydate` | Report by date range (`start`,`end`,`event`,`limit`,`offset`) | Includes channel, status_code, cost |
| GET | `/strikeapi` | List blocked numbers on the account | |
| GET | `/balance` | Account SMS balance | Returns `{"saldo":"1.500"}` (formatted string) |

> **Deprecated / removed:** endpoints previously listed as `POST /apitvoz` (Send Voice) and
> `GET /balancetvoz` (Voice balance) are **not implemented** — do not use them. Voice is sent
> through `/webapi` with the `audio` field (see [Voice](./voice.md)).

## Push Notifications (`/v1/push/*`)

Two auth modes on the same prefix:

- **Public group** (`config`, `subscribe`, `unsubscribe`, `track`) — auth by public `app_id` (+ `Origin` allow-list for `subscribe`). Safe for browser/device SDKs.
- **Server group** (everything else) — HMAC with `X-PUSH-Key` / `X-PUSH-Timestamp` / `X-PUSH-Signature`. Optional `Idempotency-Key`.

| Method | Route (`?r=`) | Auth | Purpose |
|---|---|---|---|
| GET | `/v1/push/config` | public | Public config for the SDK (VAPID key, opt-in) |
| POST | `/v1/push/subscribe` | public | Register/update a device |
| POST | `/v1/push/unsubscribe` | public | Opt a device out |
| POST | `/v1/push/track` | public | Report a device event (`delivered/open/click/close/conversion`) |
| GET/POST | `/v1/push/devices` | HMAC | List / register devices |
| DELETE | `/v1/push/devices/{id}` | HMAC | Opt out a device |
| GET/POST | `/v1/push/campaigns` | HMAC | List / create campaigns |
| GET/PATCH | `/v1/push/campaigns/{id}` | HMAC | Get / update a campaign |
| POST | `/v1/push/campaigns/{id}/send` | HMAC | Send a campaign |
| POST | `/v1/push/campaigns/{id}/{pause\|resume\|cancel\|duplicate}` | HMAC | Campaign actions |
| GET | `/v1/push/campaigns/{id}/metrics` | HMAC | Delivery/open/click/conversion metrics |
| GET/POST | `/v1/push/segments` | HMAC | List / create segments |
| POST | `/v1/push/events` · `/v1/push/conversions` | HMAC | Server-side events / conversions |
| GET | `/v1/push/reports` | HMAC | Analytics dashboard data |
| GET/POST/DELETE | `/v1/push/webhooks` | HMAC | Manage push webhooks |
| POST | `/v1/push/test` | HMAC | Send a test push |

## Conversational AI — PushAgent (`/v1/*`)

Auth: HMAC with `X-PA-Key` / `X-PA-Timestamp` / `X-PA-Signature`. See [Authentication](./authentication.md).

| Method | Route (`?r=`) | Purpose |
|---|---|---|
| POST | `/v1/conversations` | Open a conversation (`user_ext_id`, optional `name`, `channel`) |
| GET | `/v1/conversations/{id}` | Get conversation + messages |
| POST | `/v1/conversations/{id}/messages` | Send a user message (bot replies async) |
| POST | `/v1/conversations/{id}/handoff` | Hand off to a human agent |
| POST | `/v1/conversations/{id}/close` | Close the conversation |
| POST | `/v1/events` | Send a business event (context/proactivity) |
| POST | `/v1/tasks` | Schedule a follow-up (`conversation_id`, `run_at`, `text`) |

## Rate limits

| Scope | Limit |
|---|---|
| PushAgent API — per IP (pre-auth) | 300 req / 60 s |
| PushAgent API — per account | 300 req / 60 s |
| Push API — per SDK IP | 600 req / 60 s |
| Push API — per public app | 1200 req / 60 s |
| Push API — per account (HMAC) | 600 req / 60 s |

Exceeding a limit returns `429` with `{"ok": false, "error": "rate_limited"}`.

See [errors.md](./errors.md) for the full error catalog.
