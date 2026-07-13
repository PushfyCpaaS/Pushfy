# Pushfy Node.js SDK — Examples

Runnable examples for [`@pushfy/pushfy`](../../sdks/node). Each file is a
self-contained scenario using CommonJS (`require`) and reads credentials from
environment variables — no secrets in the code.

## Setup

Requires **Node.js 18+** (the SDK uses the built-in `fetch`).

```bash
npm install @pushfy/pushfy
npm install express        # only needed for receive-webhook.js
```

## Environment variables

Set only the ones your scenario needs:

| Variable               | Used by                          |
| ---------------------- | -------------------------------- |
| `PUSHFY_API_TOKEN`     | SMS, RCS, Voice, batch, retry    |
| `PUSHFY_PUSH_KEY`      | Push Notifications (server)      |
| `PUSHFY_PUSH_SECRET`   | Push Notifications (server)      |
| `WEBHOOK_SECRET`       | `receive-webhook.js`             |

```bash
export PUSHFY_API_TOKEN="your-token"
```

## Running

```bash
node send-sms.js
node send-bulk-sms.js
node send-rcs.js
node send-push.js            # needs PUSHFY_PUSH_KEY / PUSHFY_PUSH_SECRET
node send-voice.js ./welcome.mp3
node receive-webhook.js      # needs WEBHOOK_SECRET (starts an HTTP server on :3000)
node error-handling.js
node retry.js
node batch-send.js
```

## The examples

| File                  | Shows                                                            |
| --------------------- | --------------------------------------------------------------- |
| `send-sms.js`         | Send one SMS with an `extId`.                                    |
| `send-bulk-sms.js`    | Send several SMS in one request via `sendBulk()`.               |
| `send-rcs.js`         | Send an RCS rich card (title, image, tappable button).          |
| `send-push.js`        | Create + send a Push campaign and read its metrics.             |
| `send-voice.js`       | Upload an `.mp3` and place a voice call referencing it.         |
| `receive-webhook.js`  | Express server that verifies webhook signatures.                |
| `error-handling.js`   | Branch on typed errors (`AuthenticationError`, `RateLimitError`, …). |
| `retry.js`            | Exponential backoff + jitter, only for 5xx/429/timeout, idempotent via `extId`. |
| `batch-send.js`       | Send thousands by chunking the audience through `sendBulk()`.   |

## Two rules worth repeating

- **Reuse a stable `extId`** per logical message. It's how you query delivery
  status and how retries stay idempotent.
- **Never blindly resend after a timeout** — you may double-charge. Only retry
  transient errors (5xx / 429 / network), and query status by `extId` first.
