# HubSpot integration

Send an SMS, RCS, Voice or Push message from Pushfy whenever something happens in HubSpot —
for example when a contact enters a workflow, submits a form, or changes lifecycle stage.

- **Direction:** HubSpot → Pushfy (HubSpot calls a Pushfy webhook URL).
- **Provider slug:** `hubspot`
- **Best trigger:** a HubSpot **Workflow** with a *"Send a webhook"* action.

---

## Step 1 — Create the integration in Pushfy

1. Dashboard → **Settings → CRM Integrations → New integration**.
2. **Platform:** HubSpot.
3. **Channel:** e.g. `SMS`.
4. **Message:** `Hi {{properties.firstname}}, welcome to {{properties.company}}!`
5. *(Optional)* **Signing secret:** paste your HubSpot app **Client Secret** so Pushfy can verify
   the `X-HubSpot-Signature` on each request.
6. **Save** and **copy the webhook URL**.

## Step 2 — Configure the webhook in HubSpot

1. In HubSpot, create or edit a **Workflow** (Automation → Workflows).
2. Add the action **"Send a webhook"**.
3. **Method:** `POST` · **Webhook URL:** paste the Pushfy URL from Step 1.
4. Choose the contact properties to include (make sure a **phone** property is included).
5. Turn the workflow on.

> You can also use a **Private App webhook subscription**; the adapter handles both the
> workflow payload and the subscription array format.

## Authentication

HubSpot signs webhooks with **`X-HubSpot-Signature` (v1)** = `sha256(clientSecret + rawBody)`.
If you set a **signing secret** (your app's client secret) on the integration, Pushfy verifies
it and rejects anything that doesn't match. If you leave it empty, the integration still works
(authenticated only by the secret token in the URL).

## Field mapping

Pushfy reads the recipient phone from the contact, trying in order:

- `properties.phone`, `properties.mobilephone`, `properties.hs_whatsapp_phone_number`
- top-level `phone`, `phoneNumber`, `mobilephone`

Template variables come from the contact record — e.g. `{{properties.firstname}}`,
`{{properties.lastname}}`. Phone numbers are normalized automatically (digits only, country
code first). Events without a phone are skipped.

## Example

HubSpot posts something like:

```json
{
  "objectId": 1024,
  "properties": {
    "firstname": "Ana",
    "phone": "+55 (11) 99999-8888",
    "company": "Pushfy"
  }
}
```

With channel `SMS` and message `Hi {{properties.firstname}}, welcome to {{properties.company}}!`,
Pushfy sends **one SMS** to `5511999998888`: *"Hi Ana, welcome to Pushfy!"*.

## Notes

- **Idempotency:** HubSpot retries are de-duplicated (by event/object id or body hash).
- **Balance:** the SMS is charged from your normal balance; no balance → not sent.
- **Test first:** validate the mapping in **dry-run** (preview without sending) before turning
  the workflow on for real contacts.
- **Other channels:** switch the integration's channel to RCS/Voice/Push to send those instead —
  the HubSpot side stays the same.

See also: [CRM & Integrations overview](./README.md) · [Webhooks](../webhooks/README.md).
