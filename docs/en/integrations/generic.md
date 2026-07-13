# Generic / Webhook integration

Send an SMS, RCS, Voice or Push message from Pushfy whenever **any** system can make an HTTP
POST — Make, Zapier, your own backend, a cron job, a serverless function, anything. This is the
universal entry point: you build the request body yourself in Pushfy's **canonical format** and
Pushfy sends it.

- **Direction:** Your system → Pushfy (you POST to a Pushfy webhook URL).
- **Provider slug:** `generic`
- **Best trigger:** any event in any tool that can send an HTTP request.

---

## Step 1 — Create the integration in Pushfy

1. Dashboard → **Settings → CRM Integrations → New integration**.
2. **Platform:** Generic / Webhook.
3. **Channel:** e.g. `SMS`. *(The channel can also be set per-request in the payload — see below.)*
4. **Message:** *(optional)* a fallback template like `Hi {{name}}!`. Because the generic
   payload can already carry the full content, the `{{field}}` template is **optional** here.
5. *(Optional)* **Signing secret:** set a secret so Pushfy can verify each request's signature.
6. **Save** and **copy the webhook URL**.

## Step 2 — Configure the webhook in your system

1. In whatever tool is sending the event, add an **HTTP Request / Webhook** action.
2. **Method:** `POST` · **URL:** paste the Pushfy URL from Step 1.
3. **Header:** `Content-Type: application/json`.
4. **Body:** a JSON object in Pushfy's canonical format (see **Field mapping**).
5. Trigger the request whenever you want a message to go out.

> The payload already arrives in Pushfy's canonical format, so you assemble it directly — no
> platform-specific adapter parsing is needed.

## Authentication

The URL token identifies and authenticates your integration. **Optionally**, if you set a
**signing secret**, send the header:

```
X-Gateway-Signature: sha256=<hex>
```

where `<hex>` is the **HMAC-SHA256** of the **raw request body** keyed with your `signing_secret`.
The `sha256=` prefix is accepted, and so is the bare hex. If you set a signing secret, Pushfy
verifies it and rejects requests that don't match. If you leave it empty, the integration still
works (authenticated by the token in the URL).

## Field mapping

You send Pushfy's canonical payload directly. Fields:

| Field | Meaning |
|---|---|
| `canal` | channel: `sms`, `rcs`, `rcs_basic`, `voz` or `push` |
| `destinos` | array of recipient phone numbers, e.g. `["5511999998888"]` |
| `texto` | message text |
| `titulo` | title (RCS) |
| `imagem` | image URL (RCS) |
| `url` | link (RCS) |
| `cta` | button / call-to-action (RCS) |
| `audio` | audio name (Voice) |
| `push` | object `{ titulo, corpo, url }` (Push) |
| `ext_id` | your external id (used for idempotency) |

**Aliases** are accepted so you can post more natural field names:

- `to` / `phone` → `destinos`
- `text` / `message` → `texto`
- `title` → `titulo`
- `image` → `imagem`

You may POST **one object** or a **list of objects** (batch). Phone numbers are normalized
automatically (digits only, country code first). Records without a phone are skipped.

## Example

Post a single SMS:

```json
{
  "canal": "sms",
  "destinos": ["+55 (11) 99999-8888"],
  "texto": "Hi Ana, welcome to the club!",
  "ext_id": "welcome-1024"
}
```

Pushfy sends **one SMS** to `5511999998888`: *"Hi Ana, welcome to the club!"*.

Using aliases and a batch:

```json
[
  { "to": "5511999998888", "text": "First message" },
  { "phone": "5511988887777", "message": "Second message" }
]
```

## Notes

- **Idempotency:** repeated requests with the same `ext_id` (or the same body hash) are
  de-duplicated and not sent twice.
- **Balance:** each send is charged from your normal balance; no balance → not sent.
- **Test first:** validate in **dry-run** (preview without sending) before going live.
- **Any channel:** set `canal` per request, or fix the channel on the integration and omit it.

See also: [CRM & Integrations overview](./README.md) · [Webhooks](../webhooks/README.md) ·
[Send Voice](../reference/voice.md).
