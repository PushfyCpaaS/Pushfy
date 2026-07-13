# Send Voice

Send a voice call (voice broadcast) by playing a pre-recorded audio to the recipient.

Voice is sent in **two steps**:

1. **Create the audio** — upload an `.mp3` and get an audio id back.
2. **Trigger the call** — send a message on `/webapi` with that audio id in the `audio` field.

> **Heads up:** the `/apitvoz` endpoint mentioned in older documentation **does not exist** and
> returns `404`. Use the two steps below instead.

---

## Step 1 — Create the audio

- **URL** — `https://portal.pushfy.com/audio`
- **Method** — `POST`
- **Auth** — Bearer token ([Authentication](./authentication.md))
- **Content-Type** — `multipart/form-data`

Only `.mp3` files are accepted.

### Headers

```
Authorization: Bearer YOUR_API_TOKEN
Content-Type: multipart/form-data
```

### Form fields

| Field | Type | Required | Description |
|---|---|---|---|
| `nome` | string | ✅ | A name for the audio. **You'll pass this exact name in Step 2 to place the call** — keep it. |
| `audio` | file | ✅ | The audio file to upload — **`.mp3` only** |

### Request

```bash
curl -X POST 'https://portal.pushfy.com/audio' \
  -H 'Authorization: Bearer YOUR_API_TOKEN' \
  -F 'nome=Welcome message' \
  -F 'audio=@welcome.mp3'
```

### Response

`200 OK`:

```json
{
  "message": "Audio saved successfully",
  "user_id": 123
}
```

The audio is now stored under the **name** you sent in `nome`. That name is what you pass in
Step 2 — the response above does **not** return a separate audio id, so remember the `nome` you chose.

### Errors

| HTTP | Body | Cause |
|---|---|---|
| 400 | `{"error":"Only MP3"}` | Uploaded file is not an `.mp3` |
| 400 | `{"error":"No file"}` | No `audio` file in the request |
| 401 | `{"error":"Unauthorized"}` | Missing/invalid token |
| 500 | `{"error":"Upload error"}` | Temporary server error — safe to retry |

---

## Step 2 — Trigger the call

The call is triggered on the **same endpoint as SMS**, `POST /webapi`
([Send SMS](./sms.md)). Put the audio id from Step 1 in the `audio` field. When `audio` is
filled in, the message is treated as a **voice call** instead of a text message.

- **URL** — `https://portal.pushfy.com/webapi`
- **Method** — `POST`
- **Auth** — Bearer token ([Authentication](./authentication.md))
- **Content-Type** — `application/json` (required)

### Body

| Field | Type | Required | Description |
|---|---|---|---|
| `messages` | array | ✅ | One or more calls (up to 100,000 per request) |
| `messages[].destinations` | array | ✅ | Recipient list — **only the first entry is used** |
| `messages[].destinations[].to` | string | ✅ | Phone number, digits only, country code first (e.g. `5511999999999`). Min 8 digits |
| `messages[].audio` | string | ✅ | The **name** of the audio from Step 1 (the exact `nome` you set) — marks this message as a **voice call** |
| `messages[].ext_id` | string | — | Your own reference id, echoed back and used for status lookups. Auto-generated if omitted |

### Request

```bash
curl -X POST 'https://portal.pushfy.com/webapi' \
  -H 'Authorization: Bearer YOUR_API_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "messages": [
      {
        "ext_id": "call-1",
        "destinations": [{ "to": "5511999999999" }],
        "audio": "Welcome message"
      }
    ]
  }'
```

### Response

`200 OK` — an **array** with one object per call (same shape as SMS):

```json
[
  {
    "id": "call-1",
    "phone": "5511999999999",
    "date": "2026-07-12 14:33:21",
    "ext_id": "call-1"
  }
]
```

Store `ext_id` to [check the call status](./status.md) later.

---

## Checking status

On [`/getstatus`](./status.md) the channel appears as `TVOZ`, and the call outcome is in the
`statustvoz` field:

| `statustvoz` | Meaning |
|---|---|
| `Waiting` | Queued, not dialed yet |
| `Called` | The call was placed |
| `Answered` | The recipient answered |
| `Not Answered` | The recipient did not answer |
| `Invalid audio` | The audio could not be played |
| `Fail` | The call failed |

## Notes

- **Two steps, one audio.** Create the audio once with a `nome`, then reuse that **name** across as
  many calls as you want. The `audio` value in Step 2 must match that `nome` exactly.
- **Billing.** Voice is billed per call placed; unanswered calls (busy, failed, canceled,
  unreachable) are credited back in a daily reconciliation.
- **`.mp3` only.** Other formats are rejected with `{"error":"Only MP3"}`.
- **Voice = SMS with `audio`.** There is no separate voice endpoint; a `/webapi` message carrying
  an `audio` name is dialed as a voice call.
- **One recipient per message.** Only `destinations[0].to` is used; add more objects to `messages`
  for more recipients.
- **Phone format.** Digits only, country code first. Non-digits are stripped automatically.
