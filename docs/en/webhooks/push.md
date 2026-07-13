# Push webhook

Receive **Push Notification** campaign and device events as HTTP `POST`s to your own URL.

- **Direction** — Pushfy → your endpoint (`https://your-app.com/webhook`)
- **Method** — `POST`
- **Signature** — `X-Push-Signature: sha256=<hex>`, where
  `<hex> = HMAC-SHA256(raw_body, WEBHOOK_SECRET)`
- **Content-Type** — `application/json`

## Events

| Event | When it fires |
|---|---|
| `campaign.sent` | A campaign has been dispatched |
| `campaign.completed` | A campaign finished processing all recipients |
| `push.delivered` | A notification reached a device |
| `push.opened` | The user opened a notification |
| `push.clicked` | The user clicked a notification |
| `device.subscribed` | A device/browser subscribed |
| `device.unsubscribed` | A device/browser unsubscribed |
| `conversion.recorded` | A tracked conversion was recorded |

## Headers

```
X-Push-Event:     push.clicked          # the event name
X-Push-Delivery:  evt_9f2a...           # the eid — use it for idempotency
X-Push-Signature: sha256=<hex>          # HMAC-SHA256(raw_body, secret)
Content-Type:     application/json
```

## Payload

Every event uses the same envelope:

```json
{
  "eid": "evt_9f2a3c8d1e4b",
  "event": "push.clicked",
  "sent_at": "2026-07-12T13:50:00-03:00",
  "data": {
    "device_id": 551,
    "campaign_id": 91,
    "value": null
  }
}
```

| Field | Type | Description |
|---|---|---|
| `eid` | string | Unique delivery id (`evt_…`). Also in `X-Push-Delivery`. Deduplicate by this |
| `event` | string | Event name (matches `X-Push-Event`) |
| `sent_at` | string | ISO-8601 timestamp with timezone |
| `data` | object | Event-specific fields |

### Example payloads

**`campaign.completed`**

```json
{
  "eid": "evt_71b0c4aa9f21",
  "event": "campaign.completed",
  "sent_at": "2026-07-12T13:45:10-03:00",
  "data": {
    "campaign_id": 91,
    "value": null
  }
}
```

**`device.subscribed`**

```json
{
  "eid": "evt_2c55e0af7788",
  "event": "device.subscribed",
  "sent_at": "2026-07-12T13:48:22-03:00",
  "data": {
    "device_id": 551,
    "campaign_id": null,
    "value": null
  }
}
```

**`conversion.recorded`**

```json
{
  "eid": "evt_a13f9d02bc47",
  "event": "conversion.recorded",
  "sent_at": "2026-07-12T13:52:41-03:00",
  "data": {
    "device_id": 551,
    "campaign_id": 91,
    "value": 149.90
  }
}
```

## Secret

The signing secret is generated in the dashboard (**Settings → Webhooks**) as a value prefixed
`whsec_…`. It is shown once — store it as `WEBHOOK_SECRET` server-side.

## Validating the signature

Compute the HMAC over the **raw body**, prefix it with `sha256=`, and compare in constant time:

```python
import hashlib, hmac

def valid(raw_body: bytes, header: str, secret: str) -> bool:
    expected = "sha256=" + hmac.new(
        secret.encode(), raw_body, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, header or "")

# header = request.headers["X-Push-Signature"]
# secret = WEBHOOK_SECRET   (your whsec_... value)
```

Then deduplicate by `eid` (`X-Push-Delivery`) before acting on the event.

## Notes

- **Respond `2xx` fast**, process asynchronously. Timeout is ~12 s.
- **Retries** — up to 6 attempts with backoff `[immediate, 1 min, 5 min, 15 min, 1 h, 3 h]`.
- **`data.value`** is populated for value-bearing events (e.g. `conversion.recorded`) and `null`
  otherwise.

## Next steps

- [Webhooks overview](./README.md)
- [Authentication](../reference/authentication.md)
