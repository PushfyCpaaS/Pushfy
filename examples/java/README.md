# Pushfy Java SDK — Examples

Runnable, single-class examples for the Pushfy Java SDK. Each file has a
`public static void main(...)` and can be compiled and run on its own.

> These examples have **not** been compiled in this environment (no `javac`
> available). They were reviewed by hand against the SDK source for API and
> syntactic correctness; treat a first local `javac` run as the source of truth.

## Requirements

- Java 11+ (the SDK uses `java.net.http.HttpClient`).
- The Pushfy SDK on the classpath — either the built `pushfy-1.0.0.jar`
  (`mvn package` in `../../sdks/java`) or the compiled classes.
- `ReceiveWebhook.java` uses `com.sun.net.httpserver.HttpServer`, which ships
  with the JDK (no extra dependency).

## Credentials (environment only)

No secrets are hard-coded. Export what each scenario needs:

| Variable                 | Used by                          |
|--------------------------|----------------------------------|
| `PUSHFY_API_TOKEN`       | SMS, Bulk SMS, RCS, Voice, Retry, Batch, ErrorHandling |
| `PUSHFY_PUSH_KEY`        | SendPush (Push server, HMAC)     |
| `PUSHFY_PUSH_SECRET`     | SendPush (Push server, HMAC)     |
| `PUSHFY_WEBHOOK_SECRET`  | ReceiveWebhook                   |
| `AUDIO_PATH`             | SendVoice (path to an .mp3)      |

All phone numbers are the placeholder `5511999999999`.

## Compile & run one example

```bash
export PUSHFY_API_TOKEN=...

# with the built jar:
javac -cp ../../sdks/java/target/pushfy-1.0.0.jar SendSms.java -d out
java  -cp ../../sdks/java/target/pushfy-1.0.0.jar:out SendSms
```

## The scenarios

| File                  | What it shows                                                        |
|-----------------------|---------------------------------------------------------------------|
| `SendSms.java`        | `sendSms(to, text, extId)` + `messageStatus(extId, null)` lookup.   |
| `SendBulkSms.java`    | `sendBulkSms(List<Pushfy.Sms>)` — many recipients, one request.     |
| `SendRcs.java`        | `sendRcs(Pushfy.Rcs)` rich card with title/image/url/cta.           |
| `SendPush.java`       | `push.campaigns.create/send/metrics` (HMAC-signed server API).      |
| `SendVoice.java`      | `uploadAudio(...)` then `sendVoice(to, audioId, extId)`.            |
| `ReceiveWebhook.java` | `HttpServer` endpoint verifying `X-Pushfy-Signature` via `Webhooks.messaging` over the **raw** body. |
| `ErrorHandling.java`  | Catch `RateLimitException` / `AuthenticationException` / `InvalidRequestException` / `ApiException` / `PushfyException`. |
| `Retry.java`          | Exponential backoff + jitter, retrying only retryable errors, reusing one `extId` for idempotency. |
| `BatchSend.java`      | Chunk a large audience into sublists and bulk-send per chunk.        |

## Idempotency & retries

Every send takes an `extId`. Reuse the **same** `extId` when you retry after a
timeout — the API de-duplicates on it, so you are never charged twice. Never
blindly resend without it; query `messageStatus(extId, null)` first if unsure.
