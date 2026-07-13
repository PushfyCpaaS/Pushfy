# CRM & Integrations

Connect your CRM or automation tool to Pushfy and turn its events into **SMS, RCS, Voice
or Push** messages — no code. When something happens in your CRM (a new lead, a deal
stage change, a form submit), the CRM calls a Pushfy **webhook URL** and Pushfy sends the
message on the channel you chose.

The **Universal Integration Gateway** is provider-agnostic: each platform has its own
adapter that understands that platform's webhook, so you just point it at Pushfy and map a
few fields.

## Supported platforms

| Platform | Guide |
|---|---|
| Generic / Webhook | [generic.md](./generic.md) |
| n8n | [n8n.md](./n8n.md) |
| HubSpot | [hubspot.md](./hubspot.md) |
| Salesforce | [salesforce.md](./salesforce.md) |
| ActiveCampaign | [activecampaign.md](./activecampaign.md) |
| Pipedrive | [pipedrive.md](./pipedrive.md) |
| RD Station | [rdstation.md](./rdstation.md) |
| Bitrix24 | [bitrix24.md](./bitrix24.md) |
| Zoho CRM | [zoho.md](./zoho.md) |
| Monday.com | [monday.md](./monday.md) |

> Don't see your tool? Use the **[Generic / Webhook](./generic.md)** integration — anything
> that can send an HTTP POST (including n8n, Make, Zapier or your own backend) works.

## How it works

```
Your CRM  ──event──▶  Pushfy webhook URL  ──▶  authenticate + de-duplicate
                                            ──▶  map fields (adapter)
                                            ──▶  send SMS / RCS / Voice / Push
                                            ──▶  (charged from your balance)
```

## Step 1 — Create the integration in Pushfy (same for every platform)

1. Open the dashboard → **Settings → CRM Integrations** → **New integration**.
2. Pick the **platform** (HubSpot, Pipedrive, …).
3. Choose the **channel** the messages go out on: `SMS`, `RCS`, `RCS Basic`, `Voice` or `Push`.
4. Set the **message** — a template with `{{field}}` placeholders filled from the CRM record,
   e.g. `Hi {{name}}, your order is on the way!`. (For RCS add title/image/url/button; for
   Voice set the audio name; for Push set the project.)
5. *(Optional)* Set a **signing secret** so Pushfy verifies each webhook is really from your CRM.
6. **Save** and **copy the webhook URL** — it looks like:
   ```
   https://portal.pushfy.com/v2/gw.php?r=/v1/hook/gw_xxxxxxxxxxxxxxxx
   ```
   That URL contains **your unique token**. It identifies and authenticates your integration —
   keep it private and never share it.

## Step 2 — Point your CRM at the URL

Each platform has its own webhook/automation screen — see the platform's guide for the exact
steps. In all of them you paste the Pushfy webhook URL and pick which event should trigger a
message.

## What every integration gives you

- **Per-integration authentication.** Each integration has its **own token** (in the URL) and
  its **own optional signing secret**, stored encrypted. One account never sees another's data.
- **Idempotency.** If your CRM retries the same event, Pushfy detects the duplicate and does not
  send twice.
- **Balance-aware.** Sends consume your normal balance/credit, exactly like any other send. No
  balance → not sent (just like the rest of the platform).
- **Test mode (dry-run).** While an integration is being validated, Pushfy receives, checks and
  **previews** the message without sending — so you can confirm the field mapping safely first.

## Message templates

Anywhere you write a message you can use `{{field}}` to pull values from the incoming CRM
record. Nested fields use dots: `{{properties.firstname}}`, `{{contact.first_name}}`. If a
field is missing it's simply left blank. Set a **default text** as a fallback.

## Channels

Every integration can target any channel your account has enabled:

| Channel | You'll also set |
|---|---|
| SMS | message text |
| RCS / RCS Basic | title, image, url, button (CTA) |
| Voice | the **audio name** you uploaded (see [Send Voice](../reference/voice.md)) |
| Push | the push project + title/body |

See the full API in [Reference](../reference/) and delivery callbacks in [Webhooks](../webhooks/README.md).
