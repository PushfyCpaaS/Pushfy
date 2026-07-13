# Salesforce integration

Send an SMS, RCS, Voice or Push message from Pushfy whenever something happens in **Salesforce** —
for example when a Lead is created, an Opportunity changes stage, or a Case is updated. A
Salesforce **Flow** posts the record's fields to a Pushfy webhook URL.

- **Direction:** Salesforce → Pushfy (a Salesforce Flow calls a Pushfy webhook URL).
- **Provider slug:** `salesforce`
- **Best trigger:** a record-triggered **Flow** with an **HTTP Callout** action.

---

## Step 1 — Create the integration in Pushfy

1. Dashboard → **Settings → CRM Integrations → New integration**.
2. **Platform:** Salesforce.
3. **Channel:** e.g. `SMS`.
4. **Message:** `Hi {{FirstName}}, welcome aboard!` — the template pulls from the record's fields.
5. *(Optional)* **Signing secret:** set a secret so Pushfy can verify each request's signature.
6. **Save** and **copy the webhook URL**.

## Step 2 — Configure the webhook in Salesforce

1. In **Setup → Flows**, create a **record-triggered Flow** (e.g. on Contact/Lead create or update).
2. Add an **HTTP Callout** action (or use **External Services / Named Credential** pointing at
   the Pushfy URL).
3. **Method:** `POST` · **URL:** paste the Pushfy URL from Step 1.
4. **Header:** `Content-Type: application/json`.
5. **Body:** a JSON object with the record fields to send (include a phone field — see below).
6. Activate the Flow.

> A Named Credential is the cleanest way to store the endpoint and (optionally) the signature
> header, but a direct HTTP Callout from the Flow works too.

## Authentication

The URL token identifies and authenticates your integration. **Optionally**, if you set a
**signing secret**, send the header:

```
X-Gateway-Signature: sha256=<hex>
```

where `<hex>` is the **HMAC-SHA256** of the **raw request body** keyed with your `signing_secret`
(the `sha256=` prefix or bare hex are both accepted). If you set a signing secret, Pushfy
verifies it and rejects requests that don't match. If you leave it empty, the integration still
works (authenticated by the token in the URL).

## Field mapping

Pushfy reads the recipient phone from the record, trying in order:

- `MobilePhone`, `Phone`, `mobilePhone`, `phone`
- the same keys nested under `contact.*`, `record.*` or `data.*`

Template variables come from the record fields — e.g. `{{FirstName}}`, `{{LastName}}`,
`{{Company}}`. Phone numbers are normalized automatically (digits only, country code first).
Records without a phone are skipped.

## Example

Your Flow posts something like:

```json
{
  "FirstName": "Ana",
  "LastName": "Silva",
  "MobilePhone": "+55 (11) 99999-8888",
  "Company": "Acme"
}
```

With channel `SMS` and message `Hi {{FirstName}}, welcome aboard!`, Pushfy sends **one SMS** to
`5511999998888`: *"Hi Ana, welcome aboard!"*.

## Notes

- **Idempotency:** retries of the same event are de-duplicated (by record id or body hash) and
  not sent twice.
- **Balance:** the send is charged from your normal balance; no balance → not sent.
- **Test first:** validate the mapping in **dry-run** (preview without sending) before activating
  the Flow on live records.
- **Other channels:** switch the integration's channel to RCS/Voice/Push — the Salesforce side
  stays the same.

See also: [CRM & Integrations overview](./README.md) · [Webhooks](../webhooks/README.md) ·
[Send Voice](../reference/voice.md).
