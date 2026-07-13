# n8n integration

Send an SMS, RCS, Voice or Push message from Pushfy whenever an **n8n** workflow runs — for
example when a webhook fires, a schedule triggers, or a record changes in an upstream node.
n8n uses the same canonical payload as the Generic integration, built inside an **HTTP Request**
node.

- **Direction:** n8n → Pushfy (an n8n HTTP Request node calls a Pushfy webhook URL).
- **Provider slug:** `n8n`
- **Best trigger:** any n8n **Workflow** (webhook, schedule, app trigger, …).

---

## Step 1 — Create the integration in Pushfy

1. Dashboard → **Settings → CRM Integrations → New integration**.
2. **Platform:** n8n.
3. **Channel:** e.g. `SMS`. *(Can also be set per-request via the `canal` field.)*
4. **Message:** *(optional)* a fallback template. Because the n8n payload already carries the
   content, the `{{field}}` template is **optional** here.
5. *(Optional)* **Signing secret:** set a secret so Pushfy can verify each request's signature.
6. **Save** and **copy the webhook URL**.

## Step 2 — Configure the webhook in n8n

1. In your workflow, add an **HTTP Request** node.
2. **Method:** `POST` · **URL:** paste the Pushfy URL from Step 1.
3. **Body Content Type:** `JSON`.
4. **Body:** the canonical payload (same fields as the Generic integration). You can build it
   from earlier nodes with expressions, e.g. `{{ $json.phone }}` and `{{ $json.name }}`.
5. Add a **Header** `Content-Type: application/json`.
6. Save and activate the workflow.

> n8n uses the same generic adapter, so any canonical field or alias works exactly as in the
> [Generic / Webhook](./generic.md) guide.

## Authentication

The URL token identifies and authenticates your integration. **Optionally**, if you set a
**signing secret**, add the header:

```
X-Gateway-Signature: sha256=<hex>
```

where `<hex>` is the **HMAC-SHA256** of the **raw request body** keyed with your `signing_secret`
(the `sha256=` prefix or bare hex are both accepted). In n8n you can compute this with a
**Crypto** node or a **Function** node before the HTTP Request node. If you leave the signing
secret empty, the integration still works (authenticated by the token in the URL).

## Field mapping

You build Pushfy's canonical payload in the HTTP Request node's body:

| Field | Meaning |
|---|---|
| `canal` | channel: `sms`, `rcs`, `rcs_basic`, `voz` or `push` |
| `destinos` | array of recipient phone numbers |
| `texto` | message text |
| `titulo` / `imagem` / `url` / `cta` | RCS title / image / link / button |
| `audio` | audio name (Voice) |
| `push` | object `{ titulo, corpo, url }` (Push) |
| `ext_id` | your external id (used for idempotency) |

**Aliases:** `to`/`phone` → `destinos`, `text`/`message` → `texto`, `title` → `titulo`,
`image` → `imagem`. You can POST one object or a list. Phone numbers are normalized
automatically (digits only, country code first); records without a phone are skipped.

## Example

HTTP Request node body, built from a previous node:

```json
{
  "canal": "sms",
  "destinos": ["{{ $json.phone }}"],
  "texto": "Hi {{ $json.name }}, your order shipped!",
  "ext_id": "n8n-{{ $json.orderId }}"
}
```

For a run where `$json.phone` is `+55 (11) 99999-8888` and `$json.name` is `Ana`, Pushfy sends
**one SMS** to `5511999998888`: *"Hi Ana, your order shipped!"*.

## Notes

- **Idempotency:** repeated runs with the same `ext_id` (or the same body hash) are
  de-duplicated and not sent twice.
- **Balance:** each send is charged from your normal balance; no balance → not sent.
- **Test first:** use n8n's **Execute Node** and Pushfy's **dry-run** to confirm the mapping
  before activating.
- **Any channel:** set `canal` in the body, or fix the channel on the integration and omit it.

See also: [CRM & Integrations overview](./README.md) · [Generic / Webhook](./generic.md) ·
[Webhooks](../webhooks/README.md) · [Send Voice](../reference/voice.md).
