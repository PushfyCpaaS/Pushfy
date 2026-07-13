# Pushfy Go SDK — examples

Runnable examples for the [Pushfy Go SDK](https://github.com/PushfyCpaaS/pushfy-go).
Each subdirectory is a standalone `package main` program.

Requires **Go 1.21+**.

## Install the SDK

In your own project:

```bash
go get github.com/PushfyCpaaS/pushfy-go
```

```go
import "github.com/PushfyCpaaS/pushfy-go"
```

The examples in this folder resolve the SDK through a `replace` directive in
`go.mod` pointing at the sibling `../../sdks/go` package, so they run from a
checkout of this repo with no extra setup. In a real project, remove that
`replace` and depend on the published module via `go get`.

## Credentials — environment variables only

Never hardcode secrets. Every example reads what it needs from the environment.

| Variable                | Used by                          | Auth |
| ----------------------- | -------------------------------- | ---- |
| `PUSHFY_API_TOKEN`      | SMS, RCS, Voice, error-handling, retry, batch-send | Messaging Bearer token |
| `PUSHFY_PUSH_KEY`       | send-push                        | Push server HMAC key |
| `PUSHFY_PUSH_SECRET`    | send-push                        | Push server HMAC secret |
| `PUSHFY_WEBHOOK_SECRET` | receive-webhook                  | Webhook signing secret |
| `AUDIO_FILE`            | send-voice                       | Path to a local `.mp3` |

All phone numbers use the placeholder `5511999999999` — replace with real
E.164 digits (no `+`).

## Running

From this directory, run any example by its package path:

```bash
PUSHFY_API_TOKEN=... go run ./send-sms
PUSHFY_API_TOKEN=... go run ./send-bulk-sms
PUSHFY_API_TOKEN=... go run ./send-rcs
PUSHFY_PUSH_KEY=... PUSHFY_PUSH_SECRET=... go run ./send-push
PUSHFY_API_TOKEN=... AUDIO_FILE=./welcome.mp3 go run ./send-voice
PUSHFY_WEBHOOK_SECRET=... go run ./receive-webhook       # serves on :8080
PUSHFY_API_TOKEN=... go run ./error-handling
PUSHFY_API_TOKEN=... go run ./retry
PUSHFY_API_TOKEN=... go run ./batch-send
```

## What each example shows

| Example            | Focus |
| ------------------ | ----- |
| `send-sms`         | Send a single SMS; read back the accepted `[]MessageResult`. |
| `send-bulk-sms`    | Send several SMS in one `SendBulk` call, each with its own `ExtID`. |
| `send-rcs`         | Send an RCS rich card (title, text, image, URL, CTA). |
| `send-push`        | Create → send → read metrics for a Push campaign (HMAC-signed). |
| `send-voice`       | Upload an `.mp3`, then place a voice call referencing the audio id. |
| `receive-webhook`  | `http.HandleFunc` handler verifying the signature with `pushfy.VerifyMessaging` against the raw body. |
| `error-handling`   | Branch on typed errors with `errors.Is` (sentinels) and `errors.As` (`Status`, `Code`, `RetryAfter`). |
| `retry`            | Idempotent exponential backoff (fixed `ExtID`, honours `Retry-After`, retries only `ErrAPI`/`ErrRateLimit`). |
| `batch-send`       | Split a large list into chunks and `SendBulk` each one. |

## A note on idempotency

`ExtID` is your stable reference for a message. Reuse the same `ExtID` when
retrying so a message that already went through is not sent (or charged) twice.
After a send timeout, query the status by `ExtID` before resending — never
blindly resend.
