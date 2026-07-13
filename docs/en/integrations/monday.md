# Monday.com integration

Send an SMS, RCS, Voice or Push message from Pushfy whenever something happens on a Monday.com
board — for example when an item is created, moves to a group, or a status column changes.

- **Direction:** Monday.com → Pushfy (Monday calls a Pushfy webhook URL).
- **Provider slug:** `monday`
- **Best trigger:** the Monday **Webhooks** integration on your board.

---

## Step 1 — Create the integration in Pushfy

1. Dashboard → **Settings → CRM Integrations → New integration**.
2. **Platform:** Monday.com.
3. **Channel:** e.g. `SMS`.
4. **Message:** `Hi, item {{event.pulseName}} was updated!`
5. **Phone column (`phone_column`):** paste the **id of the phone column** on your board —
   Pushfy reads the phone from it (see *Field mapping*).
6. **Signing secret:** paste your Monday app's **signing secret** so Pushfy can verify the JWT
   on each request (see *Authentication*).
7. **Save** and **copy the webhook URL**.

## Step 2 — Configure the webhook in Monday.com

1. On your board, open **Integrations** and add the **Webhooks** integration.
2. Choose the recipe **"When [event], send a webhook"** (e.g. when an item is created, when a
   column changes).
3. **Webhook URL:** paste the Pushfy URL from Step 1.
4. Save the integration.

Monday posts JSON like `{ "event": { "pulseId", "boardId", "columnValues"/"value", ... } }`
and signs it with a JWT in the `Authorization` header.

## Authentication

Monday signs each webhook with a **JWT (HS256)** in the `Authorization` header, using the
**signing secret** of your Monday app. Set that **signing_secret** on the integration so Pushfy
can verify it and reject anything that doesn't match.

The initial **`challenge` handshake** (Monday sends a `challenge` value when you save the
webhook) is answered **automatically by Pushfy** — you don't need to do anything.

## Field mapping

Pushfy reads the recipient phone from the column you set as **`phone_column`**, trying in order:

- `event.columnValues[phone_column].phone`
- `event.columnValues[phone_column].value`
- `event.columnValues[phone_column].text`

Template variables come from `event` — e.g. `{{event.pulseName}}`, `{{event.boardId}}`. Phone
numbers are normalized automatically (digits only, country code first). The `ext_id` is the
`pulseId` (item id). Events without a phone are skipped.

## Example

Monday posts something like:

```json
{
  "event": {
    "pulseId": 1234567890,
    "pulseName": "Ana",
    "boardId": 987654321,
    "columnValues": {
      "phone": { "phone": "+55 (11) 99999-8888", "countryShortName": "BR" }
    }
  }
}
```

With `phone_column` = `phone`, channel `SMS` and message `Hi, item {{event.pulseName}} was
updated!`, Pushfy sends **one SMS** to `5511999998888`: *"Hi, item Ana was updated!"*.

## Notes

- **Column id, not title:** `phone_column` must be the column **id** (e.g. `phone`, `phone1`),
  not its display name.
- **Handshake:** the `challenge` request is answered automatically; no configuration needed.
- **Idempotency:** Monday retries are de-duplicated (by `pulseId`/item id or body hash).
- **Balance:** the SMS is charged from your normal balance; no balance → not sent.
- **Test first:** validate the mapping in **dry-run** (preview without sending) before turning
  the integration on for real items.
- **Other channels:** switch the integration's channel to RCS/Voice/Push to send those instead —
  the Monday side stays the same.

See also: [CRM & Integrations overview](./README.md) · [Webhooks](../webhooks/README.md).
