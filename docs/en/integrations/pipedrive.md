# Pipedrive integration

Send an SMS, RCS, Voice or Push message from Pushfy whenever something happens in Pipedrive —
for example when a person is added, a deal changes stage, or a contact is updated.

- **Direction:** Pipedrive → Pushfy (Pipedrive calls a Pushfy webhook URL).
- **Provider slug:** `pipedrive`
- **Best trigger:** a Pipedrive **Webhook** (Company Settings → Webhooks, or Tools → Webhooks).

---

## Step 1 — Create the integration in Pushfy

1. Dashboard → **Settings → CRM Integrations → New integration**.
2. **Platform:** Pipedrive.
3. **Channel:** e.g. `SMS`.
4. **Message:** `Hi {{name}}, thanks for getting in touch!`
5. **Authentication:** fill **`basic_user`** and **`basic_pass`** with the username/password you
   will set on the Pipedrive webhook (see Step 2). *(Alternatively, set a **signing secret** and
   Pushfy will verify the `X-Gateway-Signature` instead.)*
6. **Save** and **copy the webhook URL**.

## Step 2 — Configure the webhook in Pipedrive

1. In Pipedrive, go to **Company Settings → Webhooks** (or **Tools → Webhooks**).
2. **Create new webhook**.
3. **Endpoint URL:** paste the Pushfy URL from Step 1.
4. Set **HTTP Auth username/password** — use the **same** values you entered as `basic_user` /
   `basic_pass` in Step 1.
5. Pick the **event** (object + action, e.g. *person → updated*) and **save**.

## Authentication

Pipedrive supports **HTTP Basic Auth** on the webhook: it sends an
`Authorization: Basic ...` header built from the username/password you set. On the Pushfy
integration you enter matching **`basic_user`** / **`basic_pass`**, and Pushfy validates the
header — anything that doesn't match is rejected. As an alternative you can set a **signing
secret** and Pushfy will verify the **`X-Gateway-Signature`** (HMAC of the body) instead.

## Field mapping

Pipedrive posts JSON shaped like `{ event, meta: { id, action, object }, current: {...},
previous: {...} }`.

Pushfy reads the recipient phone from **`current.phone`**, which is a **list** of objects
`[{ value, primary, label }]`. It uses the entry marked **`primary: true`**, or the first one
if none is primary.

Template variables come from **`current`** — e.g. `{{name}}`, `{{email}}`. Phone numbers are
normalized automatically (digits only, country code first). Events without a phone are skipped.
The **`ext_id`** used for de-duplication is `meta.id` (falling back to `current.id`).

## Example

Pipedrive posts something like:

```json
{
  "event": "updated.person",
  "meta": { "id": 5540, "action": "updated", "object": "person" },
  "current": {
    "id": 1024,
    "name": "Ana",
    "phone": [
      { "value": "+55 (11) 99999-8888", "primary": true, "label": "mobile" }
    ]
  }
}
```

With channel `SMS` and message `Hi {{name}}, thanks for getting in touch!`, Pushfy sends
**one SMS** to `5511999998888`: *"Hi Ana, thanks for getting in touch!"*.

## Notes

- **Idempotency:** retries are de-duplicated (by `meta.id` / `current.id`, or body hash).
- **Balance:** the SMS is charged from your normal balance; no balance → not sent.
- **Test first:** validate the mapping in **dry-run** (preview without sending) before turning
  the webhook on for real records.
- **Other channels:** switch the integration's channel to RCS/Voice/Push to send those instead —
  the Pipedrive side stays the same.

See also: [CRM & Integrations overview](./README.md) · [Webhooks](../webhooks/README.md).
