# Pushfy .NET SDK — Examples

Runnable, single-file examples for the Pushfy .NET SDK. Each file has an
`async Task Main(...)` in its own class.

> These examples have **not** been compiled in this environment (no `dotnet`
> available). They were reviewed by hand against the SDK source for API and
> syntactic correctness; treat a first local `dotnet build` as the source of
> truth.

## Requirements

- .NET 6.0+.
- A reference to the Pushfy SDK — add the project in `../../sdks/dotnet` or the
  `Pushfy` NuGet package.
- `ReceiveWebhook.cs` uses `System.Net.HttpListener` from the BCL (no extra
  dependency).

## One project, one entry point

Each `*.cs` file declares its own `Main`, so they cannot all live in a single
buildable project at once. Run them one at a time. Either keep one file in the
project directory, or set the entry point explicitly:

```xml
<!-- in the .csproj -->
<PropertyGroup>
  <StartupObject>SendSmsExample</StartupObject>
</PropertyGroup>
```

The class names are `SendSmsExample`, `SendBulkSmsExample`, `SendRcsExample`,
`SendPushExample`, `SendVoiceExample`, `ReceiveWebhookExample`,
`ErrorHandlingExample`, `RetryExample`, `BatchSendExample`.

## Credentials (environment only)

No secrets are hard-coded. Set what each scenario needs:

| Variable                 | Used by                          |
|--------------------------|----------------------------------|
| `PUSHFY_API_TOKEN`       | SendSms, SendBulkSms, SendRcs, SendVoice, Retry, BatchSend, ErrorHandling |
| `PUSHFY_PUSH_KEY`        | SendPush (Push server, HMAC)     |
| `PUSHFY_PUSH_SECRET`     | SendPush (Push server, HMAC)     |
| `PUSHFY_WEBHOOK_SECRET`  | ReceiveWebhook                   |
| `AUDIO_PATH`             | SendVoice (path to an .mp3)      |

All phone numbers are the placeholder `5511999999999`.

## Run one example

```bash
export PUSHFY_API_TOKEN=...
dotnet run --project . --property:StartupObject=SendSmsExample
```

## The scenarios

| File                 | What it shows                                                        |
|----------------------|---------------------------------------------------------------------|
| `SendSms.cs`         | `SendSmsAsync(to, text, extId)` + `GetMessageStatusAsync(extId)`.    |
| `SendBulkSms.cs`     | `SendBulkSmsAsync(IEnumerable<SmsMessage>)`.                         |
| `SendRcs.cs`         | `SendRcsAsync(to, text, title, image, url, cta, extId)` rich card.   |
| `SendPush.cs`        | `Push.Campaigns.CreateAsync/SendAsync/MetricsAsync` (HMAC server API). |
| `SendVoice.cs`       | `UploadAudioAsync(...)` then `SendVoiceAsync(to, audioName, extId)`.   |
| `ReceiveWebhook.cs`  | `HttpListener` endpoint verifying `X-Pushfy-Signature` via `Webhooks.Messaging` over the **raw** body. |
| `ErrorHandling.cs`   | Catch `RateLimitException` / `AuthenticationException` / `InvalidRequestException` / `ApiException` / `PushfyException`. |
| `Retry.cs`           | Exponential backoff + jitter, retrying only retryable errors, reusing one `extId` for idempotency. |
| `BatchSend.cs`       | Chunk a large audience into batches and bulk-send per chunk.         |

## Idempotency & retries

Every send takes an `extId`. Reuse the **same** `extId` when you retry after a
timeout — the API de-duplicates on it, so you are never charged twice. Never
blindly resend without it; query `GetMessageStatusAsync(extId: ...)` first if
unsure.
