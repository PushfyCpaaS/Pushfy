# Send thousands of messages

The Messaging API is built for volume. A single `POST /webapi` accepts up to
**100,000 messages**, each with its own recipient and its own reference id. This guide
shows how to send at scale without losing track of anything: batch into sensible chunks,
tag every message with an `ext_id`, read the array response, respect rate limits, and
confirm delivery by **webhook** instead of polling one message at a time.

---

## The `messages[]` array

`/webapi` takes an array of independent messages. Each object is queued on its own and
returns its own row. Same token, same endpoint, one request:

```bash
curl -X POST 'https://portal.pushfy.com/webapi' \
  -H 'Authorization: Bearer YOUR_API_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "messages": [
      { "ext_id": "u-1001", "destinations": [{ "to": "5511999990001" }], "text": "Hi Ana" },
      { "ext_id": "u-1002", "destinations": [{ "to": "5511999990002" }], "text": "Hi Bruno" },
      { "ext_id": "u-1003", "destinations": [{ "to": "5511999990003" }], "text": "Hi Carla" }
    ]
  }'
```

The hard limit is **100,000 messages per request**; exceed it and you get
`400 max_100000`. There's also a byte limit on the body (`413 payload_too_large`). See
[Send SMS](../reference/sms.md).

---

## Step 1 — Batch into chunks

Even though one request can hold 100,000 messages, **don't** send your entire list in a
single giant call. Smaller batches are faster to build, easier to retry, and kinder to the
body-size limit. A good default is **1,000–5,000 messages per request**.

Slice your recipient list into chunks and send them one after another:

```python
import requests

URL = "https://portal.pushfy.com/webapi"
HEADERS = {
    "Authorization": "Bearer YOUR_API_TOKEN",
    "Content-Type": "application/json",
}
CHUNK = 2000  # 1,000–5,000 is a good range

def chunks(seq, n):
    for i in range(0, len(seq), n):
        yield seq[i:i + n]

# recipients: list of (user_id, phone, text)
for batch in chunks(recipients, CHUNK):
    messages = [
        {
            "ext_id": f"camp42-{uid}",          # Step 2: always set ext_id
            "destinations": [{"to": phone}],
            "text": text,
        }
        for (uid, phone, text) in batch
    ]
    r = requests.post(URL, headers=HEADERS, json={"messages": messages})
    r.raise_for_status()
    for row in r.json():                        # Step 3: response is an array
        record_accepted(row["ext_id"], row["phone"], row["date"])
```

---

## Step 2 — Always set an `ext_id` per message

At scale, `ext_id` is not optional in practice — it's how you tie every accepted message,
every delivery receipt, and every reply back to a row in your database.

- Make it **unique and deterministic**, e.g. `campaign42-user1001`.
- Derive it from your own ids so you can reconstruct it later without a lookup table.
- If you omit it, Pushfy generates one and returns it — but then you have to store the
  generated value, which is easy to drop under load.

The same `ext_id` also makes retries safe: reusing it lets you check status instead of
blindly resending. See [Handling errors](./error-handling.md).

---

## Step 3 — Read the array response

Each `/webapi` call returns **`200 OK` with an array**, one object per message, in send
order:

```json
[
  { "id": "camp42-1001", "phone": "5511999990001", "date": "2026-07-12 14:33:21", "ext_id": "camp42-1001" },
  { "id": "camp42-1002", "phone": "5511999990002", "date": "2026-07-12 14:33:21", "ext_id": "camp42-1002" }
]
```

Iterate the array and mark each `ext_id` as **accepted** (queued). Remember: acceptance is
not delivery — that's confirmed later, in Step 5.

---

## Step 4 — Respect rate limits

Send batches **sequentially**, or with a small, bounded amount of concurrency — not an
unbounded flood. If you push too hard you'll see `429` responses; when that happens, stop,
**back off exponentially** (e.g. 1s, 2s, 4s… with jitter), then resume. Retry `5xx` and
timeouts the same way, but only with the **same `ext_id`s** so a retry can't duplicate.

The details and the full backoff pattern are in [Errors & rate limits](../reference/errors.md)
and the [Handling errors guide](./error-handling.md).

> Sending is **async by design.** `/webapi` accepts and queues; delivery happens shortly
> after. A fast `200` means "queued", not "delivered".

---

## Step 5 — Confirm delivery by webhook, not per-message polling

Once you've queued tens of thousands of messages, do **not** loop over every `ext_id`
calling `/getstatus`. That's slow, wasteful, and can trip `503` under load.

Instead, register the **[messaging status webhook](../webhooks/messaging-status.md)**.
Pushfy pushes you a delivery receipt (DLR) for each message as its outcome is known — as a
JSON array you match back by `ext_id`:

```json
[
  { "ext_id": "camp42-1001", "phone": "5511999990001", "status": "Delivered", "channel": "SMS", "cost": "0.06" }
]
```

If you must pull results in bulk from the API instead, query **by day or by period** with
[`/getdate` or `/reportbydate`](../reference/status.md) (paginated up to 5,000 rows) rather
than one lookup per message.

---

## Checklist

- [ ] Batch into **1,000–5,000** messages per request (never dump all 100,000 at once).
- [ ] Set a **unique `ext_id`** on every message.
- [ ] Iterate the **array** response; mark each `ext_id` as accepted.
- [ ] Send batches sequentially; **back off** on `429`/`5xx`, retrying with the same `ext_id`s.
- [ ] Confirm delivery via the **status webhook** (or `/reportbydate`), not per-message polling.

---

## Next steps

- [Messaging status webhook](../webhooks/messaging-status.md) and the
  [Receiving webhooks guide](./receiving-webhooks.md).
- [Handling errors](./error-handling.md) — retry and idempotency without double-charging.
- [Delivery status](../reference/status.md) — by message, by day, by period.
