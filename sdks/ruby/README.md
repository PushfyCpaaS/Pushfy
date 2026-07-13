# Pushfy SDK for Ruby

Official Ruby client for the [Pushfy API](https://github.com/PushfyCpaaS/Pushfy) —
SMS, RCS, Voice, Push Notifications and Conversational AI.

- Requires **Ruby 2.7+**.
- Zero runtime dependencies — standard library only (`net/http`, `openssl`, `json`).

## Installation

```bash
gem install pushfy
```

Or add it to your `Gemfile`:

```ruby
gem "pushfy"
```

## Quick start

```ruby
require "pushfy"

pushfy = Pushfy::Client.new(api_token: "YOUR_API_TOKEN")

result = pushfy.sms.send(
  to: "5511999999999",
  text: "Hello from Pushfy",
  ext_id: "welcome-001"
)
puts result # => [{ "id" => ..., "phone" => ..., "date" => ..., "ext_id" => ... }]
```

## Authentication

Different products use different credentials — pass whatever you need:

```ruby
pushfy = Pushfy::Client.new(
  api_token:   "YOUR_API_TOKEN",  # Messaging (SMS/RCS/Voice, status, balance)
  pa_key:      "pak_...",         # Conversational AI (HMAC)
  pa_secret:   "pas_...",
  push_key:    "pushk_...",       # Push server API (HMAC)
  push_secret: "pss_...",
  app_id:      "pushapp_..."      # Public Push app id
)
```

HMAC signing for the V2 (Push / Conversational) endpoints is handled automatically.

## Usage

### SMS

```ruby
pushfy.sms.send(to: "5511999999999", text: "Hi", ext_id: "ref-1")

pushfy.sms.send_bulk([
  { to: "5511999990001", text: "Hi Ana",   ext_id: "b1" },
  { to: "5511999990002", text: "Hi Bruno", ext_id: "b2" }
])
```

### RCS

```ruby
pushfy.rcs.send(
  to: "5511999999999",
  title: "Order shipped",
  text: "Your order #1042 is on the way",
  image: "https://cdn.example.com/box.jpg",
  url: "https://example.com/track/1042",
  cta: "Track order"
)
```

### Voice

Voice is two steps: upload the mp3 with a `name`, then place the call by that
same name. The upload response does not return an audio id — keep the `name`
you chose and pass it as `audio_name`.

```ruby
pushfy.voice.upload_audio(name: "Welcome message", data: File.binread("./welcome.mp3"))
pushfy.voice.send(to: "5511999999999", audio_name: "Welcome message", ext_id: "call-1")
```

### Delivery status & balance

```ruby
pushfy.messages.status(ext_id: "ref-1")
pushfy.messages.report(start: "2026-07-01 00:00:00", finish: "2026-07-01 23:59:59")

balance = pushfy.balance.get   # => { raw: "1.500", balance: 1500 }
puts balance[:balance]
```

### Push Notifications (server)

```ruby
c = pushfy.push.campaigns.create(name: "Promo", title: "Sale!", body: "50% off", url: "https://example.com")
pushfy.push.campaigns.send(c["id"])
pushfy.push.campaigns.metrics(c["id"])
```

### Conversational AI

```ruby
conv = pushfy.conversations.open(user_ext_id: "user-42", name: "Ana")
pushfy.conversations.message(conv["conversation_id"], content: "I need help with a withdrawal")
state = pushfy.conversations.get(conv["conversation_id"]) # bot replies asynchronously
```

## Error handling

Every failure raises a typed error you can rescue on:

```ruby
begin
  pushfy.sms.send(to: "5511999999999", text: "Hi")
rescue Pushfy::RateLimitError
  # back off and retry
rescue Pushfy::AuthenticationError
  # check your token
rescue Pushfy::ApiError => e
  # 5xx / network — safe to retry idempotently (reuse the same ext_id)
  warn "#{e.status} #{e.code} #{e.response.inspect}"
end
```

All errors inherit from `Pushfy::PushfyError` and expose `#status`, `#code` and
`#response`.

> **Never blindly resend after a send timeout** — you may double-charge. Query the
> status by `ext_id` first.

## Verifying webhooks

Always verify against the **raw** request body (the exact bytes received);
re-serializing a parsed object changes the signature.

```ruby
require "pushfy"

# In a Rack/Rails controller:
raw_body  = request.body.read
signature = request.get_header("HTTP_X_PUSHFY_SIGNATURE")

ok = Pushfy::Webhooks.messaging(          # status/DLR: X-Pushfy-Signature (sha256=)
  payload: raw_body,
  signature: signature,
  secret: ENV["WEBHOOK_SECRET"]
)

head(:unauthorized) and return unless ok
head :ok # respond fast, process async
```

Helpers: `Pushfy::Webhooks.messaging(...)` and `Pushfy::Webhooks.push(...)` (both
`sha256=`), and `Pushfy::Webhooks.conversations(...)` (raw hex — PushAgent).
Comparison is constant-time.

## License

MIT © Pushfy
