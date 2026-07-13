# Pushfy TypeScript SDK — Examples

Runnable, self-contained examples for the [`@pushfy/pushfy`](../../sdks/typescript) SDK.
Each file is one scenario and reads its credentials from environment variables —
**no secrets are hard-coded**. Phone numbers use the placeholder `5511999999999`.

## Files

| File | What it shows | Env vars |
| --- | --- | --- |
| `send-sms.ts` | Send a single SMS | `PUSHFY_API_TOKEN` |
| `send-bulk-sms.ts` | Send many SMS in one request | `PUSHFY_API_TOKEN` |
| `send-rcs.ts` | Send an RCS rich card (title/image/URL/CTA) | `PUSHFY_API_TOKEN` |
| `send-push.ts` | Create + dispatch a Push campaign, read metrics | `PUSHFY_PUSH_KEY`, `PUSHFY_PUSH_SECRET` |
| `send-voice.ts` | Upload an mp3 and place a voice call | `PUSHFY_API_TOKEN` |
| `receive-webhook.ts` | Express server verifying webhook signatures | `WEBHOOK_SECRET` (+ `PUSH_WEBHOOK_SECRET`, `PA_WEBHOOK_SECRET`) |
| `error-handling.ts` | Branch on typed errors via `instanceof` | `PUSHFY_API_TOKEN` |
| `retry.ts` | Exponential backoff + jitter, idempotent | `PUSHFY_API_TOKEN` |
| `batch-send.ts` | Chunk a large audience with bounded concurrency | `PUSHFY_API_TOKEN` |

## Prerequisites

- **Node.js 18+** (the SDK uses the built-in `fetch`).
- The SDK and dev tooling:

```bash
# From this examples/typescript directory:
npm init -y
npm install @pushfy/pushfy
npm install -D typescript ts-node @types/node

# Only needed for receive-webhook.ts:
npm install express
npm install -D @types/express
```

## Setting credentials

Never commit secrets. Export them in your shell (or use a `.env` loader):

```bash
export PUSHFY_API_TOKEN="your-messaging-token"      # SMS / RCS / Voice
export PUSHFY_PUSH_KEY="pushk_..."                   # Push server API
export PUSHFY_PUSH_SECRET="pss_..."
export WEBHOOK_SECRET="your-messaging-webhook-secret"
export PUSH_WEBHOOK_SECRET="your-push-webhook-secret"
export PA_WEBHOOK_SECRET="your-conversations-webhook-secret"
```

## Running

Run any example directly with `ts-node`:

```bash
npx ts-node send-sms.ts
npx ts-node send-bulk-sms.ts
npx ts-node send-rcs.ts
npx ts-node send-push.ts
npx ts-node send-voice.ts ./welcome.mp3     # pass the mp3 path as an argument
npx ts-node error-handling.ts
npx ts-node retry.ts
npx ts-node batch-send.ts

# Webhook receiver (long-running HTTP server):
npx ts-node receive-webhook.ts              # listens on http://localhost:3000
```

### Or compile first, then run with Node

```bash
npx tsc --strict --esModuleInterop --skipLibCheck --moduleResolution node \
  --target ES2020 --module CommonJS --outDir dist *.ts
node dist/send-sms.js
```

A minimal `tsconfig.json` for these examples:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist"
  }
}
```

## Notes

- **Idempotency:** always pass a stable `extId`. Pushfy dedupes by `ext_id`, so a
  retry after a timeout will not double-charge. See `retry.ts` and `batch-send.ts`.
- **Webhooks:** verify against the **raw** request body. Re-serializing the JSON
  changes the bytes and breaks the signature — `receive-webhook.ts` uses
  `express.raw`.
- **Errors:** every failure is a subclass of `PushfyError`
  (`AuthenticationError`, `RateLimitError`, `InvalidRequestError`, `ApiError`),
  each with `status`, `code` and `response`.
