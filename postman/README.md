# Pushfy API — Postman collection

A ready-to-use Postman collection (schema **v2.1.0**) and environment for the Pushfy API:
**Messaging** (SMS / RCS / Voice, status, balance), **Push Notifications** (public SDK + server
HMAC) and **Conversational AI** (PushAgent).

Files in this folder:

| File | What it is |
|---|---|
| `Pushfy.postman_collection.json` | The collection (4 folders, 20 requests) |
| `Pushfy.postman_environment.json` | Environment **Pushfy - Production** (base URLs + credential placeholders) |

## Import

1. Open Postman → **Import** (top-left).
2. Drag both JSON files in (or **Import → Files**).
3. Top-right environment selector → choose **Pushfy - Production**.

## Configure credentials

Open the environment (the eye icon → **Edit**) and fill in the values you have. `base_url` and
`v2_url` are pre-filled for production.

| Variable | Used by | Example |
|---|---|---|
| `base_url` | Messaging | `https://portal.pushfy.com` |
| `v2_url` | Push + PushAgent gateway | `https://portal.pushfy.com/v2/api.php` |
| `api_token` | Messaging (Bearer) | Settings → API Tokens |
| `app_id` | Push (Public) | `pushapp_...` |
| `push_key` / `push_secret` | Push (Server, HMAC) | `pushk_...` / `pss_...` |
| `pa_key` / `pa_secret` | Conversational AI (HMAC) | `pak_...` / `pas_...` |
| `last_ext_id` | auto-set by *Send SMS*, read by *Get Status* | — |
| `conversation_id` | auto-set by *Open Conversation* | — |

Secrets (`api_token`, `pa_secret`, `push_secret`, `pa_key`, `push_key`) are typed as **secret** in
the environment, so Postman masks them. Keep them out of shared/exported environments.

## How authentication works

The collection handles all three schemes for you:

- **Messaging** — the collection's default auth is **Bearer `{{api_token}}`**, inherited by every
  request in the *Messaging* folder. Nothing else to do.
- **Push (Public)** — no signature. The public `{{app_id}}` travels in the query/body. These
  requests are set to **No Auth** so no Bearer header leaks.
- **Push (Server, HMAC)** and **Conversational AI (HMAC)** — signed **automatically** by a
  collection-level **pre-request script**. You never compute a signature by hand.

### The auto-signer (collection pre-request script)

On every request the script checks whether the URL hits `/v2/api.php`. If so it:

1. reads the route from the `?r=` query param (this is the signed `path`, **including** any ids,
   e.g. `/v1/conversations/123/messages` or `/v1/push/campaigns/987/send`);
2. skips the four **public** Push routes (`config`, `subscribe`, `unsubscribe`, `track`);
3. picks the credential set by route family —
   `/v1/push/*` → `push_key`/`push_secret` + `X-PUSH-*` headers,
   otherwise → `pa_key`/`pa_secret` + `X-PA-*` headers;
4. builds the canonical string
   `timestamp \n METHOD \n path \n sha256hex(body)` and signs it with HMAC-SHA256 (via the
   built-in `CryptoJS`);
5. upserts `X-*-Key`, `X-*-Timestamp`, `X-*-Signature` onto the request.

If the relevant key/secret is empty the request is left unsigned (and a note is logged to the
Postman console) — so fill the credentials before firing HMAC requests. The server accepts a
**±300 s** timestamp window, so your machine clock must be roughly correct.

> **Editing ids:** for requests that embed an id (Send Campaign, Post Message, Get/Handoff/Close
> Conversation, Campaign Metrics), the signed path comes from the `?r=` query param. If you change
> the id, change it in **both** the URL and the `r` param so the signature matches the route.

## Suggested run order

1. **Messaging → Send SMS** — saves `last_ext_id`.
2. **Messaging → Get Status** — looks it up.
3. **Conversational AI → Open Conversation** — saves `conversation_id`, then *Post Message* →
   *Get Conversation* (poll for the bot reply) → *Handoff* / *Close*.
4. **Push (Server)** — *Create Campaign* → *Send Campaign* → *Campaign Metrics*.

**Voice** is two steps: *Upload Audio (Voice step 1)* returns an audio id; paste it into the
`audio` field of *Send Voice (step 2)*.

## Tests included

- **Send SMS** — asserts `200` and stores the sent `ext_id` into `last_ext_id`.
- **V2 requests** — assert `2xx` and `response.ok === true`.
- Other requests — a generic `2xx` status check.

Open **View → Show Postman Console** to see the signer logs and the saved variables.
