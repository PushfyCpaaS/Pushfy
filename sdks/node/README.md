# Pushfy SDK for Node.js

Official Node.js client for the [Pushfy API](https://github.com/PushfyCpaaS/Pushfy) —
SMS, RCS, Voice, Push Notifications and Conversational AI.

- Requires **Node.js 18+** (uses the built-in `fetch`).
- Zero runtime dependencies.

## Installation

```bash
npm install @pushfy/pushfy
```

## Quick start

```js
const { Pushfy } = require('@pushfy/pushfy');

const pushfy = new Pushfy({ apiToken: 'YOUR_API_TOKEN' });

const result = await pushfy.sms.send({
  to: '5511999999999',
  text: 'Hello from Pushfy 👋',
  extId: 'welcome-001',
});
console.log(result); // [{ id, phone, date, ext_id }]
```

## Authentication

Different products use different credentials — pass whatever you need:

```js
const pushfy = new Pushfy({
  apiToken:   'YOUR_API_TOKEN',   // Messaging (SMS/RCS/Voice, status, balance)
  paKey:      'pak_...',          // Conversational AI (HMAC)
  paSecret:   'pas_...',
  pushKey:    'pushk_...',        // Push server API (HMAC)
  pushSecret: 'pss_...',
  appId:      'pushapp_...',      // Public Push app id
});
```

HMAC signing for the V2 (Push/Conversational) endpoints is handled automatically.

## Usage

### SMS

```js
await pushfy.sms.send({ to: '5511999999999', text: 'Hi', extId: 'ref-1' });

await pushfy.sms.sendBulk([
  { to: '5511999990001', text: 'Hi Ana',   extId: 'b1' },
  { to: '5511999990002', text: 'Hi Bruno', extId: 'b2' },
]);
```

### RCS

```js
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

```js
const fs = require('fs');
const { user_id } = await pushfy.voice.uploadAudio({
  name: 'welcome',
  data: fs.readFileSync('./welcome.mp3'),
});
await pushfy.voice.send({ to: '5511999999999', audioId: 'AUDIO_ID', extId: 'call-1' });
```

### Delivery status & balance

```js
await pushfy.messages.status({ extId: 'ref-1' });     // [{ phone, status, channel, ... }]
await pushfy.messages.report({ start: '2026-07-01 00:00:00', end: '2026-07-01 23:59:59' });
const { balance } = await pushfy.balance.get();        // { raw: "1.500", balance: 1500 }
```

### Push Notifications (server)

```js
const c = await pushfy.push.campaigns.create({ name: 'Promo', title: 'Sale!', body: '50% off', url: 'https://example.com' });
await pushfy.push.campaigns.send(c.id);
await pushfy.push.campaigns.metrics(c.id);
```

### Conversational AI

```js
const conv = await pushfy.conversations.open({ userExtId: 'user-42', name: 'Ana' });
await pushfy.conversations.message(conv.conversation_id, { content: 'I need help with a withdrawal' });
const state = await pushfy.conversations.get(conv.conversation_id); // bot replies asynchronously
```

## Error handling

Every failure throws a typed error you can branch on:

```js
const { AuthenticationError, RateLimitError, InvalidRequestError, ApiError } = require('@pushfy/pushfy');

try {
  await pushfy.sms.send({ to: '5511999999999', text: 'Hi' });
} catch (err) {
  if (err instanceof RateLimitError) {
    // back off and retry
  } else if (err instanceof AuthenticationError) {
    // check your token
  } else if (err instanceof ApiError) {
    // 5xx / network — safe to retry idempotently (reuse the same extId)
  }
  console.error(err.status, err.code, err.response);
}
```

> **Never blindly resend after a send timeout** — you may double-charge. Query the status by
> `extId` first.

## Verifying webhooks

```js
const { Pushfy } = require('@pushfy/pushfy');
const express = require('express');
const app = express();

// keep the RAW body for signature verification
app.use(express.raw({ type: '*/*' }));

app.post('/webhooks/pushfy', (req, res) => {
  const ok = Pushfy.webhooks.messaging({           // status/DLR: X-Pushfy-Signature (sha256=)
    payload: req.body,
    signature: req.header('X-Pushfy-Signature'),
    secret: process.env.WEBHOOK_SECRET,
  });
  if (!ok) return res.sendStatus(401);
  res.sendStatus(200); // respond fast, process async
});
```

Helpers: `Pushfy.webhooks.messaging(...)`, `Pushfy.webhooks.push(...)` (both `sha256=`),
and `Pushfy.webhooks.conversations(...)` (raw hex — PushAgent).

## License

MIT © Pushfy
