'use strict';

// Create and send a Push Notification campaign (server-side).
//
// Run:  PUSHFY_PUSH_KEY=... PUSHFY_PUSH_SECRET=... node send-push.js
//
// The Push server API uses HMAC (pushKey/pushSecret) — the SDK signs for you.

const { Pushfy } = require('@pushfy/pushfy');

const pushfy = new Pushfy({
  pushKey: process.env.PUSHFY_PUSH_KEY,
  pushSecret: process.env.PUSHFY_PUSH_SECRET,
});

async function main() {
  // 1. Create the campaign.
  const campaign = await pushfy.push.campaigns.create({
    name: 'Promo July',
    title: 'Flash sale ⚡',
    body: '50% off — today only',
    url: 'https://example.com/promo',
  });
  console.log('Created campaign:', campaign.id);

  // 2. Dispatch it to the subscribed devices.
  await pushfy.push.campaigns.send(campaign.id);
  console.log('Campaign sent.');

  // 3. (Optional) read delivery/engagement metrics.
  const metrics = await pushfy.push.campaigns.metrics(campaign.id);
  console.log('Metrics:', metrics);
}

main().catch((err) => {
  console.error('Push failed:', err.status, err.code, err.message);
  process.exitCode = 1;
});
