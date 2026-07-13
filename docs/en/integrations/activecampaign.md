# ActiveCampaign integration

Send an SMS, RCS, Voice or Push message from Pushfy whenever something happens in
ActiveCampaign — for example when a contact subscribes, is updated, or enters an automation.

- **Direction:** ActiveCampaign → Pushfy (ActiveCampaign calls a Pushfy webhook URL).
- **Provider slug:** `activecampaign`
- **Best trigger:** an ActiveCampaign **Webhook** (or a *"Webhook"* action inside an Automation).

---

## Step 1 — Create the integration in Pushfy

1. Dashboard → **Settings → CRM Integrations → New integration**.
2. **Platform:** ActiveCampaign.
3. **Channel:** e.g. `SMS`.
4. **Message:** `Hi {{first_name}}, welcome aboard!`
5. *(Optional)* **Signing secret:** set a secret so Pushfy can verify the
   `X-Gateway-Signature` (HMAC of the request body) on each request.
6. **Save** and **copy the webhook URL**.

## Step 2 — Configure the webhook in ActiveCampaign

1. In ActiveCampaign, go to **Settings → Developer → Webhooks**.
2. **Add** a webhook: paste the Pushfy URL from Step 1.
3. Choose the events to send (e.g. **subscribe**, **contact_update**).
4. **Save**.

> You can also add a **"Webhook" action** inside an **Automation** and point it at the same
> Pushfy URL — the adapter handles both.

## Authentication

ActiveCampaign posts `application/x-www-form-urlencoded` data. If you set a **signing secret**
on the integration, Pushfy verifies the **`X-Gateway-Signature`** header (an HMAC of the raw
body computed with your `signing_secret`) and rejects anything that doesn't match. If you leave
it empty, the integration still works (authenticated only by the secret token in the URL).

## Field mapping

Pushfy reads the recipient phone from **`contact.phone`**.

Template variables come from the contact record — e.g. `{{first_name}}`, `{{email}}`,
`{{id}}`. Phone numbers are normalized automatically (digits only, country code first).
Events without a phone are skipped. The **`ext_id`** used for de-duplication is the contact
`id` combined with the event `type` (e.g. `subscribe`, `contact_update`).

## Example

ActiveCampaign posts form fields like:

```
type=subscribe
contact[id]=1024
contact[email]=ana@example.com
contact[phone]=+55 (11) 99999-8888
contact[first_name]=Ana
```

With channel `SMS` and message `Hi {{first_name}}, welcome aboard!`, Pushfy sends
**one SMS** to `5511999998888`: *"Hi Ana, welcome aboard!"*.

## Notes

- **Idempotency:** repeated posts are de-duplicated (by contact `id` + `type`, or body hash).
- **Balance:** the SMS is charged from your normal balance; no balance → not sent.
- **Test first:** validate the mapping in **dry-run** (preview without sending) before turning
  the webhook on for real contacts.
- **Other channels:** switch the integration's channel to RCS/Voice/Push to send those instead —
  the ActiveCampaign side stays the same.

See also: [CRM & Integrations overview](./README.md) · [Webhooks](../webhooks/README.md).
