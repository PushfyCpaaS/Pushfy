# Pushfy SDK for TypeScript

Official TypeScript client for the [Pushfy API](https://github.com/PushfyCpaaS/Pushfy) —
SMS, RCS, Voice, Push Notifications and Conversational AI.

- Requires **Node.js 18+** (uses the built-in `fetch`).
- Zero runtime dependencies.
- Ships full type declarations (`dist/index.d.ts`).

## Installation

```bash
npm install @pushfy/pushfy
```

## Quick start

```ts
import { Pushfy } from '@pushfy/pushfy';

const pushfy = new Pushfy({ apiToken: 'YOUR_API_TOKEN' });

const result = await pushfy.sms.send({
  to: '5511999999999',
  text: 'Hello from Pushfy 👋',
  extId: 'welcome-001',
});
console.log(result); // [{ id, phone, date, ext_id }]
```

CommonJS works too:

```ts
const { Pushfy } = require('@pushfy/pushfy');
```

## Authentication

Different products use different credentials — pass whatever you need. All options
are typed via the `PushfyOptions` interface:

```ts
import { Pushfy, PushfyOptions } from '@pushfy/pushfy';

const opts: PushfyOptions = {
  apiToken:   'YOUR_API_TOKEN',   // Messaging (SMS/RCS/Voice, status, balance)
  paKey:      'pak_...',          // Conversational AI (HMAC)
  paSecret:   'pas_...',
  pushKey:    'pushk_...',        // Push server API (HMAC)
  pushSecret: 'pss_...',
  appId:      'pushapp_...',      // Public Push app id
};

const pushfy = new Pushfy(opts);
```

HMAC signing for the V2 (Push/Conversational) endpoints is handled automatically:
`base = timestamp + "\n" + METHOD + "\n" + route + "\n" + sha256hex(body)`, sent as
`X-PA-*` headers for Conversational AI and `X-PUSH-*` headers for the Push server API.

## Usage by product

### SMS

```ts
import { SmsSendParams, MessageSendResult } from '@pushfy/pushfy';

await pushfy.sms.send({ to: '5511999999999', text: 'Hi', extId: 'ref-1' });

await pushfy.sms.sendBulk([
  { to: '5511999990001', text: 'Hi Ana',   extId: 'b1' },
  { to: '5511999990002', text: 'Hi Bruno', extId: 'b2' },
]);
```

### RCS

```ts
await pushfy.rcs.send({
  to: '5511999999999',
  title: 'Order shipped',
  text: 'Your order #1042 is on the way',
  image: 'https://cdn.example.com/box.jpg',
  url: 'https://example.com/track/1042',
  cta: 'Track order',
});
```

### Voice

Voice is two steps: upload the mp3 with a `name`, then place the call by that
same name. The upload response does not return an audio id — keep the `name`
you chose and pass it as `audioName`.

```ts
import { readFileSync } from 'fs';

await pushfy.voice.uploadAudio({
  name: 'Welcome message',
  data: readFileSync('./welcome.mp3'),
});
await pushfy.voice.send({ to: '5511999999999', audioName: 'Welcome message', extId: 'call-1' });
```

### Delivery status & balance

```ts
await pushfy.messages.status({ extId: 'ref-1' });
await pushfy.messages.byDate('2026-07-01');
await pushfy.messages.report({ start: '2026-07-01 00:00:00', end: '2026-07-01 23:59:59' });

const { raw, balance } = await pushfy.balance.get(); // { raw: "1.500", balance: 1500 }
```

### Push Notifications (server)

```ts
const c = await pushfy.push.campaigns.create({ name: 'Promo', title: 'Sale!', body: '50% off', url: 'https://example.com' });
await pushfy.push.campaigns.send((c as any).id);
await pushfy.push.campaigns.metrics((c as any).id);

// Device / segment management
await pushfy.push.devices.list();
await pushfy.push.segments.create({ name: 'VIP' });

// Public (browser/app) — app_id is injected automatically
await pushfy.push.subscribe({ token: 'DEVICE_TOKEN' });
await pushfy.push.track({ event: 'open', campaign_id: 'camp_1' });
```

### Conversational AI

```ts
const conv = await pushfy.conversations.open({ userExtId: 'user-42', name: 'Ana' });
const id = (conv as any).conversation_id;
await pushfy.conversations.message(id, { content: 'I need help with a withdrawal' });
const state = await pushfy.conversations.get(id); // the bot replies asynchronously

await pushfy.events.send({ type: 'deposit', userExtId: 'user-42', data: { amount: 100 } });
await pushfy.tasks.schedule({ conversationId: id, runAt: '2026-07-14T10:00:00Z', text: 'Follow up' });
```

## Error handling

Every failure throws a typed error you can branch on with `instanceof`:

```ts
import { AuthenticationError, RateLimitError, InvalidRequestError, ApiError } from '@pushfy/pushfy';

try {
  await pushfy.sms.send({ to: '5511999999999', text: 'Hi' });
} catch (err) {
  if (err instanceof RateLimitError) {
    // back off and retry — err.retryAfter (seconds) when known
  } else if (err instanceof AuthenticationError) {
    // check your token / HMAC keys
  } else if (err instanceof InvalidRequestError) {
    // fix the request (400/413/415)
  } else if (err instanceof ApiError) {
    // 5xx / network — safe to retry idempotently (reuse the same extId)
  }
  console.error((err as ApiError).status, (err as ApiError).code, (err as ApiError).response);
}
```

> **Never blindly resend after a send timeout** — you may double-charge. Query the status by
> `extId` first.

All error classes extend `PushfyError` (`status`, `code`, `response`).

## Verifying webhooks

Use the static `Pushfy.webhooks` helpers (also exported directly as `webhooks`). Always pass
the **raw** request body — re-serializing changes the signature.

```ts
import { Pushfy } from '@pushfy/pushfy';
import express from 'express';

const app = express();
app.use(express.raw({ type: '*/*' })); // keep the RAW body

app.post('/webhooks/pushfy', (req, res) => {
  const ok = Pushfy.webhooks.messaging({          // status/DLR: X-Pushfy-Signature (sha256=<hex>)
    payload: req.body,
    signature: req.header('X-Pushfy-Signature'),
    secret: process.env.WEBHOOK_SECRET!,
  });
  if (!ok) return res.sendStatus(401);
  res.sendStatus(200); // respond fast, process async
});
```

Helpers and their signature scheme:

| Helper | Header | Scheme |
| --- | --- | --- |
| `Pushfy.webhooks.messaging(...)` | `X-Pushfy-Signature` | `sha256=<hex>` (prefixed) |
| `Pushfy.webhooks.push(...)` | `X-Push-Signature` | `sha256=<hex>` (prefixed) |
| `Pushfy.webhooks.conversations(...)` | `X-PA-Signature` | `<hex>` (raw) |

The general `Pushfy.webhooks.verify({ payload, signature, secret, scheme })` accepts
`scheme: 'prefixed' | 'raw'`.

## Building from source

```bash
npm install
npm run build      # tsc -> dist/ (JS + .d.ts)
npm run typecheck  # tsc --noEmit
npm run smoke      # compile + run the offline smoke test
```

## License

MIT © Pushfy
