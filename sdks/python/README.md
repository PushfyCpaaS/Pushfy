# Pushfy SDK for Python

Official Python client for the [Pushfy API](https://github.com/PushfyCpaaS/Pushfy) —
SMS, RCS, Voice, Push Notifications and Conversational AI.

- Requires **Python 3.8+**.
- **Zero runtime dependencies** — uses only the standard library (`urllib`).

## Installation

```bash
pip install pushfy
```

## Quick start

```python
from pushfy import Pushfy

pushfy = Pushfy(api_token="YOUR_API_TOKEN")

result = pushfy.sms.send(
    to="5511999999999",
    text="Hello from Pushfy",
    ext_id="welcome-001",
)
print(result)  # [{"id": ..., "phone": ..., "date": ..., "ext_id": ...}]
```

## Authentication

Different products use different credentials — pass whatever you need:

```python
pushfy = Pushfy(
    api_token="YOUR_API_TOKEN",   # Messaging (SMS/RCS/Voice, status, balance)
    pa_key="pak_...",             # Conversational AI (HMAC)
    pa_secret="pas_...",
    push_key="pushk_...",         # Push server API (HMAC)
    push_secret="pss_...",
    app_id="pushapp_...",         # Public Push app id
)
```

HMAC signing for the V2 (Push / Conversational) endpoints is handled automatically.

## Usage

### SMS

```python
pushfy.sms.send(to="5511999999999", text="Hi", ext_id="ref-1")

pushfy.sms.send_bulk([
    {"to": "5511999990001", "text": "Hi Ana",   "ext_id": "b1"},
    {"to": "5511999990002", "text": "Hi Bruno", "ext_id": "b2"},
])
```

### RCS

```python
pushfy.rcs.send(
    to="5511999999999",
    title="Order shipped",
    text="Your order #1042 is on the way",
    image="https://cdn.example.com/box.jpg",
    url="https://example.com/track/1042",
    cta="Track order",
)
```

### Voice

```python
with open("welcome.mp3", "rb") as fh:
    result = pushfy.voice.upload_audio(name="welcome", data=fh.read())

pushfy.voice.send(to="5511999999999", audio_id="AUDIO_ID", ext_id="call-1")
```

### Delivery status & balance

```python
pushfy.messages.status(ext_id="ref-1")     # [{"phone": ..., "status": ..., ...}]
pushfy.messages.report(start="2026-07-01 00:00:00", end="2026-07-01 23:59:59")

balance = pushfy.balance.get()             # {"raw": "1.500", "balance": 1500}
print(balance["balance"])
```

### Push Notifications (server)

```python
campaign = pushfy.push.campaigns.create(
    {"name": "Promo", "title": "Sale!", "body": "50% off", "url": "https://example.com"}
)
pushfy.push.campaigns.send(campaign["id"])
pushfy.push.campaigns.metrics(campaign["id"])
```

### Conversational AI

```python
conv = pushfy.conversations.open(user_ext_id="user-42", name="Ana")
pushfy.conversations.message(conv["conversation_id"], content="I need help with a withdrawal")
state = pushfy.conversations.get(conv["conversation_id"])  # bot replies asynchronously
```

## Error handling

Every failure raises a typed error you can branch on:

```python
from pushfy import AuthenticationError, RateLimitError, InvalidRequestError, ApiError

try:
    pushfy.sms.send(to="5511999999999", text="Hi")
except RateLimitError:
    ...  # back off and retry
except AuthenticationError:
    ...  # check your token
except ApiError as err:
    # 5xx / network — safe to retry idempotently (reuse the same ext_id)
    print(err.status, err.code, err.response)
```

> **Never blindly resend after a send timeout** — you may double-charge. Query the
> status by `ext_id` first.

## Verifying webhooks

Always verify against the **raw** request body — re-serializing changes the signature.

```python
from pushfy import webhooks

# Messaging status / DLR: X-Pushfy-Signature (sha256=<hex>)
ok = webhooks.messaging(
    payload=raw_body,                     # bytes or str, exactly as received
    signature=request.headers["X-Pushfy-Signature"],
    secret=WEBHOOK_SECRET,
)

# Push Notifications: X-Push-Signature (sha256=<hex>)
webhooks.push(payload=raw_body, signature=sig, secret=WEBHOOK_SECRET)

# Conversational AI: X-PA-Signature (raw hex)
webhooks.conversations(payload=raw_body, signature=sig, secret=WEBHOOK_SECRET)
```

`webhooks.messaging` and `webhooks.push` expect the `sha256=` prefix;
`webhooks.conversations` expects a bare hex digest.

## Development

```bash
python -m pytest tests/         # or: python tests/test_smoke.py
```

## License

MIT © Pushfy
