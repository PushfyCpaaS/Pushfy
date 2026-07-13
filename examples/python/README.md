# Pushfy — Python examples

Runnable, single-scenario examples for the [Pushfy Python SDK](../../sdks/python/).
Each file is self-contained, reads credentials from environment variables, and
never hardcodes secrets.

## Install

```bash
pip install pushfy
```

Requires Python 3.8+. The SDK itself has zero runtime dependencies (standard
library only), and so do these examples.

## Environment variables

Set only the variables an example actually uses:

| Variable | Used by | What it is |
|---|---|---|
| `PUSHFY_API_TOKEN` | `send_sms`, `send_bulk_sms`, `send_rcs`, `send_voice`, `error_handling`, `retry`, `batch_send` | Messaging API token (SMS/RCS/Voice) |
| `PUSHFY_PUSH_KEY` / `PUSHFY_PUSH_SECRET` | `send_push` | Push server API HMAC credentials |
| `WEBHOOK_SECRET` | `receive_webhook` | Signing secret from **Settings → Webhooks** |
| `PORT` | `receive_webhook` | Optional listen port (default `8000`) |

All example phone numbers are the placeholder `5511999999999` (E.164 digits, no
leading `+`). Swap in real destinations before sending.

## Examples

| File | Scenario |
|---|---|
| `send_sms.py` | Send one SMS |
| `send_bulk_sms.py` | Send several SMS in one `send_bulk` request |
| `send_rcs.py` | Send a rich RCS message (title, image, CTA button) |
| `send_push.py` | Create, send and read metrics for a Push campaign |
| `send_voice.py` | Upload an audio file and place a voice call |
| `receive_webhook.py` | Minimal `http.server` receiver that verifies the signature |
| `error_handling.py` | Catch the typed errors the SDK raises |
| `retry.py` | Idempotent exponential backoff for transient failures |
| `batch_send.py` | Split a large recipient list into chunks |

## Run

```bash
# Messaging
PUSHFY_API_TOKEN=your_token python3 send_sms.py
PUSHFY_API_TOKEN=your_token python3 send_bulk_sms.py
PUSHFY_API_TOKEN=your_token python3 send_rcs.py
PUSHFY_API_TOKEN=your_token python3 send_voice.py path/to/welcome.mp3

# Push (server API)
PUSHFY_PUSH_KEY=pushk_... PUSHFY_PUSH_SECRET=pss_... python3 send_push.py

# Patterns
PUSHFY_API_TOKEN=your_token python3 error_handling.py
PUSHFY_API_TOKEN=your_token python3 retry.py
PUSHFY_API_TOKEN=your_token python3 batch_send.py

# Webhook receiver — then POST to http://localhost:8000/webhook
WEBHOOK_SECRET=your_secret python3 receive_webhook.py
```

## Notes

- **Keep `ext_id` stable and unique.** It is your reference for a message: use it
  to query delivery status and to dedupe safely on retries.
- **Never blindly resend after a timeout** — the request may have succeeded
  server-side. Look up the status by `ext_id` first, or reuse the same `ext_id`
  so the platform can dedupe.
- **Verify webhooks against the raw body** in constant time — re-serializing the
  JSON changes the signature. The `pushfy.webhooks` helpers do this for you.
