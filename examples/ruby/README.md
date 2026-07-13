# Pushfy Ruby SDK — Examples

Runnable, single-scenario examples for the [Pushfy Ruby SDK](../../sdks/ruby).
Every example reads its credentials from environment variables — **no secrets are
hard-coded**. Phone numbers use the placeholder `5511999999999`; replace them
with real destinations before sending.

## Install

```bash
gem install pushfy
```

The webhook example also uses `webrick`, which ships with the standard library
on Ruby 2.7–3.0 and is a bundled gem afterwards:

```bash
gem install webrick   # only needed on Ruby 3.1+
```

## Environment variables

Set only the ones each example needs:

| Variable                | Used by                          | What it is                              |
|-------------------------|----------------------------------|-----------------------------------------|
| `PUSHFY_API_TOKEN`      | SMS, RCS, Voice, batch, retry    | Messaging Bearer token                  |
| `PUSHFY_AUDIO_PATH`     | `send_voice.rb`                  | Path to a local `.mp3` file             |
| `PUSHFY_PUSH_KEY`       | `send_push.rb`                   | Push server HMAC key (`pushk_...`)      |
| `PUSHFY_PUSH_SECRET`    | `send_push.rb`                   | Push server HMAC secret (`pss_...`)     |
| `PUSHFY_WEBHOOK_SECRET` | `receive_webhook.rb`             | Shared secret for the messaging webhook |
| `PORT`                  | `receive_webhook.rb` (optional)  | Listen port (default `4567`)            |

Example:

```bash
export PUSHFY_API_TOKEN="your-messaging-token"
```

## Run

Each file is standalone — run it directly:

```bash
ruby send_sms.rb
```

If you are working from a checkout of this repo (before `gem install pushfy`),
put the SDK's `lib/` on the load path:

```bash
ruby -I../../sdks/ruby/lib send_sms.rb
```

## Examples

| File                  | Scenario                                                        |
|-----------------------|----------------------------------------------------------------|
| `send_sms.rb`         | Send a single SMS                                              |
| `send_bulk_sms.rb`    | Send many SMS in one request, each with its own `ext_id`      |
| `send_rcs.rb`         | Send an RCS rich card (title, image, url, CTA)                |
| `send_push.rb`        | Create, send and measure a Push Notification campaign         |
| `send_voice.rb`       | Upload an `.mp3` and place a voice call                       |
| `receive_webhook.rb`  | Minimal WEBrick server verifying the signature via `Pushfy::Webhooks` |
| `error_handling.rb`   | Rescue each typed error (`AuthenticationError`, `RateLimitError`, …) |
| `retry.rb`            | Idempotent exponential backoff with jitter                    |
| `batch_send.rb`       | Split a large audience into fixed-size chunks                 |

## Notes

- **Idempotency:** every send passes a stable `ext_id`. After a timeout, never
  blindly resend — query `pushfy.messages.status(ext_id:)` first, or reuse the
  same `ext_id` so a duplicate is not charged twice.
- **Reports:** the date-range report uses the keyword `finish:` (not `end:`),
  e.g. `pushfy.messages.report(start: "...", finish: "...")`.
- **Webhooks:** always verify against the **raw** request body — re-serializing a
  parsed payload changes the signature.
