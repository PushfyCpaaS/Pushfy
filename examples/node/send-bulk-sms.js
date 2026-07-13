'use strict';

// Send several SMS in a single request with sendBulk().
//
// Run:  PUSHFY_API_TOKEN=... node send-bulk-sms.js
//
// Use this when you already have a small, in-memory list (up to a few hundred).
// For thousands of recipients, chunk the list — see batch-send.js.

const { Pushfy } = require('@pushfy/pushfy');

const pushfy = new Pushfy({ apiToken: process.env.PUSHFY_API_TOKEN });

async function main() {
  // Each entry carries its own text and a unique extId.
  const messages = [
    { to: '5511999999999', text: 'Hi Ana, your code is 1234',   extId: 'otp-ana' },
    { to: '5511999999999', text: 'Hi Bruno, your code is 5678', extId: 'otp-bruno' },
    { to: '5511999999999', text: 'Hi Carla, your code is 9012', extId: 'otp-carla' },
  ];

  const result = await pushfy.sms.sendBulk(messages);

  // One array element per accepted message: [{ id, phone, date, ext_id }]
  console.log(`Accepted ${result.length} message(s):`, result);
}

main().catch((err) => {
  console.error('Bulk send failed:', err.status, err.code, err.message);
  process.exitCode = 1;
});
