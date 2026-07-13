# Bitrix24 integration

Send an SMS, RCS, Voice or Push message from Pushfy whenever something happens in Bitrix24 —
for example when a deal is created, a lead is added, or a contact changes stage.

- **Direction:** Bitrix24 → Pushfy (Bitrix24 calls a Pushfy webhook URL).
- **Provider slug:** `bitrix24`
- **Best trigger:** a Bitrix24 **Outbound webhook** (or a Business Process "webhook" step).

---

## Step 1 — Create the integration in Pushfy

1. Dashboard → **Settings → CRM Integrations → New integration**.
2. **Platform:** Bitrix24.
3. **Channel:** e.g. `SMS`.
4. **Message:** `Hi {{data.FIELDS.NAME}}, we received your request!`
5. **Application token:** paste the **application_token** of your Bitrix24 outbound webhook so
   Pushfy can verify each request (see *Authentication*).
6. *(Optional)* **Phone field (`campo_telefone`):** the field inside `data.FIELDS` that carries
   the phone, if it isn't the default `PHONE`/`MOBILE`.
7. **Save** and **copy the webhook URL**.

## Step 2 — Configure the webhook in Bitrix24

1. In Bitrix24, open **Developer resources** and create an **Outbound webhook** (or add a
   *"webhook"* step to a Business Process).
2. **Handler URL:** paste the Pushfy URL from Step 1.
3. **Event:** choose the trigger, e.g. `ONCRMDEALADD`, `ONCRMLEADADD`.
4. **Include fields:** Bitrix usually sends only the record **ID** — configure the webhook to
   include the record fields so the **phone** actually reaches Pushfy (see *Field mapping*).
5. Save and enable the webhook.

Bitrix24 posts as `application/x-www-form-urlencoded` with `event` (e.g. `ONCRMDEALADD`),
`data[FIELDS][ID]`, `auth[application_token]` and `auth[domain]`.

## Authentication

On the integration set the **application_token**. Pushfy compares it with the incoming
`auth.application_token` and rejects anything that doesn't match. The URL token still
authenticates the integration on its own; the application token is an extra check for Bitrix24.

## Field mapping

Pushfy reads the recipient phone from the record fields, trying in order:

- `data.FIELDS.PHONE` — a list like `[{ "VALUE": "...", "VALUE_TYPE": "WORK" }]`; the `VALUE`
  is used.
- `data.FIELDS.MOBILE`
- a configurable field `campo_telefone` inside `data.FIELDS`.

Template variables come from the record — e.g. `{{data.FIELDS.NAME}}`, `{{event}}`. Phone
numbers are normalized automatically (digits only, country code first). The `ext_id` is
`event:ID`. **Events without a phone are skipped.**

## Example

Bitrix24 posts something like:

```
event=ONCRMDEALADD
data[FIELDS][ID]=42
data[FIELDS][NAME]=Ana
data[FIELDS][PHONE][0][VALUE]=+55 (11) 99999-8888
data[FIELDS][PHONE][0][VALUE_TYPE]=WORK
auth[application_token]=abc123
auth[domain]=your.bitrix24.com
```

With channel `SMS` and message `Hi {{data.FIELDS.NAME}}, we received your request!`, Pushfy
sends **one SMS** to `5511999998888`: *"Hi Ana, we received your request!"*.

## Notes

- **Include the phone:** if the webhook sends only the ID, no phone arrives and the event is
  **skipped**. Add the fields to the webhook so `PHONE`/`MOBILE` reach Pushfy. Fetching the
  record back over the Bitrix REST API is a **future phase** — for now the phone must be in the
  webhook payload.
- **Idempotency:** Bitrix retries are de-duplicated (by `event:ID` or body hash).
- **Balance:** the SMS is charged from your normal balance; no balance → not sent.
- **Test first:** validate the mapping in **dry-run** (preview without sending) before turning
  the webhook on for real records.
- **Other channels:** switch the integration's channel to RCS/Voice/Push to send those instead —
  the Bitrix24 side stays the same.

See also: [CRM & Integrations overview](./README.md) · [Webhooks](../webhooks/README.md).
