# Zoho CRM integration

Send an SMS, RCS, Voice or Push message from Pushfy whenever something happens in Zoho CRM —
for example when a lead is created, a deal changes stage, or a record is updated.

- **Direction:** Zoho CRM → Pushfy (Zoho calls a Pushfy webhook URL).
- **Provider slug:** `zoho`
- **Best trigger:** a Zoho **Workflow Rule** with an *Instant Action → Webhook*.

---

## Step 1 — Create the integration in Pushfy

1. Dashboard → **Settings → CRM Integrations → New integration**.
2. **Platform:** Zoho CRM.
3. **Channel:** e.g. `SMS`.
4. **Message:** `Hi {{Full_Name}}, welcome to our store!`
5. *(Optional)* **Signing secret:** set a secret so Pushfy can verify each request via the
   `X-Gateway-Signature` header or a `token` in the payload (see *Authentication*).
6. **Save** and **copy the webhook URL**.

## Step 2 — Configure the webhook in Zoho CRM

1. In Zoho CRM go to **Setup → Automation → Workflow Rules** and create or edit a rule.
2. Add an **Instant Action → Webhook** (or a **Function** if you need more control).
3. **Method:** `POST` · **URL to notify:** paste the Pushfy URL from Step 1.
4. **Body:** map the record fields you need — e.g. `Phone`, `Mobile`, `Full_Name`. You can send
   them flat or wrapped as `{ "data": [ { ... } ] }`.
5. Save and associate the action with the rule.

## Authentication

Authentication is optional and can be done two ways:

- **`X-Gateway-Signature`** — an HMAC of the raw body computed with your **signing_secret**.
- **`token`** in the payload — a plain value compared against your **signing_secret**.

If you set a **signing secret** on the integration, Pushfy verifies one of the above and rejects
anything that doesn't match. If you leave it empty, the integration still works (authenticated
only by the secret token in the URL).

## Field mapping

Pushfy reads the recipient phone from the record, trying in order:

- `Mobile`, `Phone`
- `data.0.Mobile`, `data.0.Phone`

If `data` is a **list**, Pushfy sends **one message per record** in it. Template variables come
from the record — e.g. `{{Full_Name}}`, `{{Phone}}`. Phone numbers are normalized automatically
(digits only, country code first). The `ext_id` is `id` (or `data.0.id`). Events without a phone
are skipped.

## Example

Zoho posts something like:

```json
{
  "data": [
    {
      "id": "554023000000123001",
      "Full_Name": "Ana",
      "Mobile": "+55 (11) 99999-8888"
    }
  ]
}
```

With channel `SMS` and message `Hi {{Full_Name}}, welcome to our store!`, Pushfy sends **one SMS**
to `5511999998888`: *"Hi Ana, welcome to our store!"*.

## Notes

- **Batch records:** a `data` array with several records produces one send per record.
- **Idempotency:** Zoho retries are de-duplicated (by record id or body hash).
- **Balance:** the SMS is charged from your normal balance; no balance → not sent.
- **Test first:** validate the mapping in **dry-run** (preview without sending) before turning
  the workflow rule on for real records.
- **Other channels:** switch the integration's channel to RCS/Voice/Push to send those instead —
  the Zoho side stays the same.

See also: [CRM & Integrations overview](./README.md) · [Webhooks](../webhooks/README.md).
