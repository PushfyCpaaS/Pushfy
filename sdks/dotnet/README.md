# Pushfy SDK for .NET

Official .NET client for the [Pushfy API](https://github.com/PushfyCpaaS/Pushfy) —
SMS, RCS, Voice, Push Notifications and Conversational AI.

- Targets **.NET 6.0+**.
- Zero third-party dependencies (uses `HttpClient`, `System.Text.Json`, `System.Security.Cryptography`).

## Installation

```bash
dotnet add package Pushfy
```

## Quick start

```csharp
using Pushfy;

var pushfy = new PushfyClient(new PushfyClientOptions { ApiToken = "YOUR_API_TOKEN" });

var result = await pushfy.SendSmsAsync(
    to: "5511999999999",
    text: "Hello from Pushfy",
    extId: "welcome-001");

Console.WriteLine(result); // [{ id, phone, date, ext_id }]
```

> Results are returned as `System.Text.Json.JsonElement` so you can read fields
> directly (`result[0].GetProperty("ext_id").GetString()`) without a fixed schema.

## Authentication

Different products use different credentials — pass whatever you need:

```csharp
var pushfy = new PushfyClient(new PushfyClientOptions
{
    ApiToken   = "YOUR_API_TOKEN",   // Messaging (SMS/RCS/Voice, status, balance)
    PaKey      = "pak_...",          // Conversational AI (HMAC)
    PaSecret   = "pas_...",
    PushKey    = "pushk_...",        // Push server API (HMAC)
    PushSecret = "pss_...",
    AppId      = "pushapp_...",      // Public Push app id
});
```

HMAC signing for the V2 (Push/Conversational) endpoints is handled automatically.

## Usage

### SMS

```csharp
await pushfy.SendSmsAsync("5511999999999", "Hi", extId: "ref-1");

await pushfy.SendBulkSmsAsync(new[]
{
    new SmsMessage("5511999990001", "Hi Ana",   "b1"),
    new SmsMessage("5511999990002", "Hi Bruno", "b2"),
});
```

### RCS

```csharp
await pushfy.SendRcsAsync(
    to: "5511999999999",
    text: "Your order #1042 is on the way",
    title: "Order shipped",
    image: "https://cdn.example.com/box.jpg",
    url: "https://example.com/track/1042",
    cta: "Track order");
```

### Voice

Voice is two steps: upload the mp3 with a name, then place the call by that
same name. The upload response does not return an audio id — keep the name
you chose and pass it as `audioName`.

```csharp
await pushfy.UploadAudioAsync("Welcome message", File.ReadAllBytes("./welcome.mp3"));
await pushfy.SendVoiceAsync("5511999999999", audioName: "Welcome message", extId: "call-1");
```

### Delivery status & balance

```csharp
await pushfy.GetMessageStatusAsync(extId: "ref-1");
await pushfy.GetReportAsync(new ReportQuery { Start = "2026-07-01 00:00:00", End = "2026-07-01 23:59:59" });

var balance = await pushfy.GetBalanceAsync(); // { Raw = "1.500", Balance = 1500 }
```

### Push Notifications (server)

```csharp
var c = await pushfy.Push.Campaigns.CreateAsync(new { name = "Promo", title = "Sale!", body = "50% off", url = "https://example.com" });
var id = c.GetProperty("id").GetInt32();
await pushfy.Push.Campaigns.SendAsync(id);
await pushfy.Push.Campaigns.MetricsAsync(id);
```

### Conversational AI

```csharp
var conv = await pushfy.OpenConversationAsync("user-42", name: "Ana");
var id = conv.GetProperty("conversation_id").GetInt64();
await pushfy.PostMessageAsync(id, "I need help with a withdrawal");
var state = await pushfy.GetConversationAsync(id); // bot replies asynchronously
```

## Error handling

Every failure throws a typed exception you can branch on:

```csharp
try
{
    await pushfy.SendSmsAsync("5511999999999", "Hi");
}
catch (RateLimitException)
{
    // back off and retry
}
catch (AuthenticationException)
{
    // check your token
}
catch (ApiException)
{
    // 5xx / network — safe to retry idempotently (reuse the same extId)
}
catch (PushfyException err)
{
    Console.Error.WriteLine($"{err.Status} {err.Code} {err.Response}");
}
```

Hierarchy: `PushfyException` is the base; `AuthenticationException`,
`InvalidRequestException`, `RateLimitException` and `ApiException` derive from it.

> **Never blindly resend after a send timeout** — you may double-charge. Query the
> status by `extId` first.

## Verifying webhooks

Always verify against the **raw** request body bytes — re-serializing changes the signature.

```csharp
// In an ASP.NET Core minimal API:
app.MapPost("/webhooks/pushfy", async (HttpRequest req) =>
{
    using var reader = new StreamReader(req.Body);
    var raw = await reader.ReadToEndAsync();

    var ok = Webhooks.Messaging(              // status/DLR: X-Pushfy-Signature (sha256=)
        payload:   raw,
        signature: req.Headers["X-Pushfy-Signature"],
        secret:    Environment.GetEnvironmentVariable("WEBHOOK_SECRET"));

    return ok ? Results.Ok() : Results.Unauthorized();
});
```

Helpers: `Webhooks.Messaging(...)` and `Webhooks.Push(...)` (both `sha256=`),
and `Webhooks.Conversations(...)` (raw hex — PushAgent). Comparison is constant-time
via `CryptographicOperations.FixedTimeEquals`.

## License

MIT © Pushfy
