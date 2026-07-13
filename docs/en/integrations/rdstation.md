# RD Station integration

Send an SMS, RCS, Voice or Push message from Pushfy whenever something happens in RD Station —
for example when a lead converts, changes stage, or reaches a point in an automation flow.

- **Direction:** RD Station → Pushfy (RD Station calls a Pushfy webhook URL).
- **Provider slug:** `rdstation`
- **Best trigger:** an RD Station Marketing **Webhook** (Integrations → Webhook, or a *"send to
  webhook"* action in an automation flow).

---

## Step 1 — Create the integration in Pushfy

1. Dashboard → **Settings → CRM Integrations → New integration**.
2. **Platform:** RD Station.
3. **Channel:** e.g. `SMS`.
4. **Message:** `Hi {{name}}, thanks for your interest!`
5. *(Optional)* **Signing secret:** set a secret so Pushfy can verify each request — either a
   **`token`** field in the payload, or the `X-Gateway-Signature` header.
6. **Save** and **copy the webhook URL**.

## Step 2 — Configure the webhook in RD Station

1. In **RD Station Marketing**, go to **Integrations → Webhook** (or add a *"send to webhook"*
   action inside an automation flow).
2. **Trigger:** choose the event (e.g. conversion / stage change).
3. **URL:** paste the Pushfy URL from Step 1.
4. Include the lead fields you need (make sure a **phone** field is included) and **save**.

## Authentication

RD Station posts JSON. If you set a **signing secret** on the integration, Pushfy accepts the
request when either the payload's **`token`** matches your `signing_secret`, **or** the
**`X-Gateway-Signature`** header (HMAC of the body) matches. If you leave it empty, the
integration still works (authenticated only by the secret token in the URL).

## Field mapping

RD Station may post a single lead directly, or wrap leads as `{ "leads": [ {...} ] }` — Pushfy
handles both (**one send per lead**).

Pushfy reads the recipient phone trying in order: **`mobile_phone`**, then **`personal_phone`**.

Template variables come from the lead record — e.g. `{{name}}`, `{{email}}`. Custom fields are
reachable by dot-path: `{{custom_fields.plan}}`. Phone numbers are normalized automatically
(digits only, country code first). Leads without a phone are skipped. The **`ext_id`** used for
de-duplication is the lead `uuid` (falling back to `id`, then `email`).

## Example

RD Station posts something like:

```json
{
  "leads": [
    {
      "uuid": "e2b1-...-9f",
      "name": "Ana",
      "email": "ana@example.com",
      "mobile_phone": "+55 (11) 99999-8888",
      "custom_fields": { "plan": "Pro" }
    }
  ]
}
```

With channel `SMS` and message `Hi {{name}}, thanks for your interest!`, Pushfy sends
**one SMS** to `5511999998888`: *"Hi Ana, thanks for your interest!"*.

## Notes

- **Idempotency:** retries are de-duplicated (by lead `uuid` / `id` / `email`, or body hash).
- **Balance:** the SMS is charged from your normal balance; no balance → not sent.
- **Test first:** validate the mapping in **dry-run** (preview without sending) before turning
  the webhook on for real leads.
- **Other channels:** switch the integration's channel to RCS/Voice/Push to send those instead —
  the RD Station side stays the same.

See also: [CRM & Integrations overview](./README.md) · [Webhooks](../webhooks/README.md).
