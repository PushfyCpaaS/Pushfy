# Pushfy SDK for Go

Official Go client for the [Pushfy API](https://github.com/PushfyCpaaS/Pushfy) —
SMS, RCS, Voice, Push Notifications and Conversational AI (PushAgent).

- Requires **Go 1.21+**.
- **Zero dependencies** — standard library only.

## Installation

```bash
go get github.com/PushfyCpaaS/pushfy-go
```

```go
import "github.com/PushfyCpaaS/pushfy-go"
```

The package name is `pushfy`.

## Quick start

```go
package main

import (
	"context"
	"fmt"

	"github.com/PushfyCpaaS/pushfy-go"
)

func main() {
	client := pushfy.New(pushfy.WithAPIToken("YOUR_API_TOKEN"))

	res, err := client.SMS.Send(context.Background(), pushfy.SMSMessage{
		To:    "5511999999999",
		Text:  "Hello from Pushfy",
		ExtID: "welcome-001",
	})
	if err != nil {
		panic(err)
	}
	fmt.Printf("%+v\n", res) // []MessageResult{{ID, Phone, Date, ExtID}}
}
```

## Authentication

Different products use different credentials — pass whatever you need:

```go
client := pushfy.New(
	pushfy.WithAPIToken("YOUR_API_TOKEN"),          // Messaging (SMS/RCS/Voice, status, balance)
	pushfy.WithPACredentials("pak_...", "pas_..."), // Conversational AI (HMAC)
	pushfy.WithPushCredentials("pushk_...", "pss_..."), // Push server API (HMAC)
	pushfy.WithAppID("pushapp_..."),                // Public Push app id
)
```

Or build a `pushfy.Config` and call `pushfy.NewWithConfig(cfg)`. HMAC signing for
the V2 (Push / Conversational) endpoints is handled automatically.

Options: `WithAPIToken`, `WithPACredentials`, `WithPushCredentials`, `WithAppID`,
`WithBaseURL`, `WithTimeout`, `WithHTTPClient`.

## Usage

Every method takes a `context.Context` first and returns `(result, error)`.

### SMS

```go
client.SMS.Send(ctx, pushfy.SMSMessage{To: "5511999999999", Text: "Hi", ExtID: "ref-1"})

client.SMS.SendBulk(ctx, []pushfy.SMSMessage{
	{To: "5511999990001", Text: "Hi Ana", ExtID: "b1"},
	{To: "5511999990002", Text: "Hi Bruno", ExtID: "b2"},
})
```

### RCS

```go
client.RCS.Send(ctx, pushfy.RCSMessage{
	To:    "5511999999999",
	Title: "Order shipped",
	Text:  "Your order #1042 is on the way",
	Image: "https://cdn.example.com/box.jpg",
	URL:   "https://example.com/track/1042",
	CTA:   "Track order",
})
```

### Voice

Voice is two steps: upload the mp3 with a Name, then place the call by that
same name. The upload response does not return an audio id — keep the Name
you chose and pass it as AudioName.

```go
data, _ := os.ReadFile("./welcome.mp3")
_, _ = client.Voice.UploadAudio(ctx, pushfy.VoiceUpload{Name: "Welcome message", Data: data})
client.Voice.Send(ctx, pushfy.VoiceCall{To: "5511999999999", AudioName: "Welcome message", ExtID: "call-1"})
```

### Delivery status & balance

```go
client.Messages.Status(ctx, pushfy.StatusQuery{ExtID: "ref-1"})
client.Messages.Report(ctx, pushfy.ReportQuery{Start: "2026-07-01 00:00:00", End: "2026-07-01 23:59:59"})

bal, _ := client.Balance.Get(ctx) // &Balance{Raw: "1.500", Amount: 1500}
fmt.Println(bal.Amount)
```

### Push Notifications (server)

```go
c, _ := client.Push.Campaigns.Create(ctx, map[string]any{
	"name": "Promo", "title": "Sale!", "body": "50% off", "url": "https://example.com",
})
_ = c
client.Push.Campaigns.Send(ctx, "CAMPAIGN_ID")
client.Push.Campaigns.Metrics(ctx, "CAMPAIGN_ID")
```

Public endpoints inject the configured `AppID` automatically:

```go
client.Push.Subscribe(ctx, map[string]any{"token": "...", "platform": "web"})
client.Push.Track(ctx, map[string]any{"event": "opened", "campaign_id": "..."})
```

### Conversational AI

```go
conv, _ := client.Conversations.Open(ctx, pushfy.OpenConversation{UserExtID: "user-42", Name: "Ana"})
_ = conv // parse conversation_id from the JSON
client.Conversations.Message(ctx, "CONVERSATION_ID", "I need help with a withdrawal")
state, _ := client.Conversations.Get(ctx, "CONVERSATION_ID") // bot replies asynchronously
_ = state
```

## Error handling

Every failure returns a typed error. Branch with `errors.Is` (sentinels) or
`errors.As` (typed, for fields like `Status`, `Code`, `Response`, `RetryAfter`):

```go
res, err := client.SMS.Send(ctx, pushfy.SMSMessage{To: "5511999999999", Text: "Hi"})
if err != nil {
	switch {
	case errors.Is(err, pushfy.ErrRateLimit):
		// back off and retry
	case errors.Is(err, pushfy.ErrAuthentication):
		// check your token
	case errors.Is(err, pushfy.ErrAPI):
		// 5xx / network — safe to retry idempotently (reuse the same ExtID)
	}

	var pe *pushfy.PushfyError
	if errors.As(err, &pe) {
		fmt.Println(pe.Status, pe.Code, pe.Response)
	}
}
_ = res
```

Sentinels: `ErrAuthentication`, `ErrInvalidRequest`, `ErrRateLimit`, `ErrAPI`.
Typed errors: `*AuthenticationError`, `*InvalidRequestError`, `*RateLimitError`
(`.RetryAfter`), `*APIError`, all embedding `*PushfyError`.

> **Never blindly resend after a send timeout** — you may double-charge. Query the
> status by `ExtID` first.

## Verifying webhooks

Pass the **raw** request body (exact bytes). Verification is constant-time.

```go
func handler(w http.ResponseWriter, r *http.Request) {
	body, _ := io.ReadAll(r.Body) // raw bytes — do not re-serialize
	ok := pushfy.VerifyMessaging(body, r.Header.Get("X-Pushfy-Signature"), os.Getenv("WEBHOOK_SECRET"))
	if !ok {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}
	w.WriteHeader(http.StatusOK) // respond fast, process async
}
```

Helpers:

- `VerifyMessaging` — status/DLR, `X-Pushfy-Signature: sha256=<hex>`
- `VerifyPush` — Push Notifications, `X-Push-Signature: sha256=<hex>`
- `VerifyConversations` — PushAgent, `X-PA-Signature: <hex>` (raw)

Or call `Verify(payload, signature, secret, scheme)` with `SchemePrefixed` /
`SchemeRaw` directly.

## HMAC signing

The V2 canonical string is signed for you, but `Sign` is exported if you need it:

```
base      = timestamp + "\n" + METHOD + "\n" + route + "\n" + sha256hex(body)
signature = hex(HMAC-SHA256(base, secret))
```

```go
ts, sig := pushfy.Sign("POST", "/v1/conversations", body, "pas_...", 0) // 0 -> now
```

## License

MIT © Pushfy
