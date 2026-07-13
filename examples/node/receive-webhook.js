'use strict';

// Minimal Express server that receives Pushfy delivery-status (DLR) webhooks
// and verifies the HMAC signature before trusting the payload.
//
// Run:  WEBHOOK_SECRET=... node receive-webhook.js
//   then point your Pushfy webhook at  http://<host>:3000/webhooks/pushfy
//
// Requires express:  npm install express

const express = require('express');
const { Pushfy } = require('@pushfy/pushfy');

const app = express();

// IMPORTANT: keep the RAW body. Signature verification hashes the exact bytes
// received — a re-serialized JSON object would produce a different signature.
app.use(express.raw({ type: '*/*' }));

app.post('/webhooks/pushfy', (req, res) => {
  // Messaging status webhooks send:  X-Pushfy-Signature: sha256=<hex>
  const ok = Pushfy.webhooks.messaging({
    payload: req.body,                          // raw Buffer
    signature: req.header('X-Pushfy-Signature'),
    secret: process.env.WEBHOOK_SECRET,
  });

  if (!ok) {
    console.warn('Rejected webhook: bad signature');
    return res.sendStatus(401);
  }

  // Respond fast (200), then process asynchronously so Pushfy doesn't retry.
  res.sendStatus(200);

  const event = JSON.parse(req.body.toString('utf8'));
  setImmediate(() => {
    console.log('DLR received:', event);
    // e.g. update your DB by ext_id / status here
  });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Listening for webhooks on :${port}`));
