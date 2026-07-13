# Pushfy PHP SDK — Examples

Runnable examples for the [Pushfy PHP SDK](../../sdks/php) covering SMS, RCS,
Voice, Push Notifications, webhook verification, error handling, idempotent
retries, and batched sends.

Every example loads credentials from environment variables — **no secrets are
hard-coded**. Placeholder phone numbers use `5511999999999`.

## Install

From this directory, pull in the SDK via Composer:

```bash
composer require pushfy/pushfy
```

This creates `vendor/autoload.php`, which each example requires. (If you are
running against a local checkout of the SDK, point a `path` repository at
`../../sdks/php` in your `composer.json`.)

## Environment variables

Set only the ones each example needs:

| Variable                | Used by                              | Purpose                                  |
| ----------------------- | ------------------------------------ | ---------------------------------------- |
| `PUSHFY_API_TOKEN`      | SMS, RCS, Voice, retry, batch, errors | Messaging bearer token                   |
| `PUSHFY_PUSH_KEY`       | `send-push.php`                      | Push server API key (HMAC)               |
| `PUSHFY_PUSH_SECRET`    | `send-push.php`                      | Push server API secret (HMAC)            |
| `PUSHFY_WEBHOOK_SECRET` | `receive-webhook.php`                | Shared secret to verify webhook signatures |
| `PUSHFY_AUDIO_FILE`     | `send-voice.php`                     | Path to an `.mp3` to upload              |

Example:

```bash
export PUSHFY_API_TOKEN="your-messaging-token"
export PUSHFY_PUSH_KEY="pushk_..."
export PUSHFY_PUSH_SECRET="pss_..."
export PUSHFY_WEBHOOK_SECRET="your-webhook-secret"
```

## How to run

CLI examples run directly with `php`:

```bash
php send-sms.php
php send-bulk-sms.php
php send-rcs.php
php send-push.php
PUSHFY_AUDIO_FILE=./welcome.mp3 php send-voice.php
php error-handling.php
php retry.php
php batch-send.php
```

`receive-webhook.php` is an HTTP endpoint, not a CLI script. Serve it and point
your Pushfy webhook at it:

```bash
php -S 0.0.0.0:8080 receive-webhook.php
# then configure your messaging-status webhook URL to http://<host>:8080/
```

## Examples

| File                   | What it shows                                                       |
| ---------------------- | ------------------------------------------------------------------- |
| `send-sms.php`         | Single SMS with an `extId` idempotency key                          |
| `send-bulk-sms.php`    | Many SMS in one `sendBulk()` request                                |
| `send-rcs.php`         | RCS rich card: title, image, tracked URL, call-to-action           |
| `send-push.php`        | Create → send → read metrics for a Push campaign (HMAC-signed)      |
| `send-voice.php`       | Upload an mp3, then place a voice call by audio id                  |
| `receive-webhook.php`  | Verify the signature over the **raw** body via `Pushfy\Webhooks`   |
| `error-handling.php`   | Branch on typed exceptions (auth / rate-limit / 4xx / 5xx)          |
| `retry.php`            | Exponential backoff + jitter, idempotent via a stable `extId`      |
| `batch-send.php`       | Split a large audience into chunks with pacing and per-chunk retry |

## Idempotency & billing safety

- Always attach a **stable, unique `extId`** to each message. It is your
  idempotency key for status lookups and safe retries.
- **Never blindly resend after a timeout** — query
  `messages->status(['extId' => ...])` first, or you may double-charge.
- Retry only transient failures (`ApiException` for 5xx/network,
  `RateLimitException` for 429). Auth and 4xx errors are fatal.

## Verifying webhooks

Verification always runs against the **raw** request body and is constant-time.
The header and scheme differ per product:

| Product            | Header               | Helper                          |
| ------------------ | -------------------- | ------------------------------- |
| Messaging status   | `X-Pushfy-Signature` | `Webhooks::messaging(...)`      |
| Push Notifications | `X-Push-Signature`   | `Webhooks::push(...)`           |
| Conversational AI  | `X-PA-Signature`     | `Webhooks::conversations(...)`  |
