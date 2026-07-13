'use strict';

// Send a single SMS.
//
// Run:  PUSHFY_API_TOKEN=... node send-sms.js
//
// Credentials come from the environment — never hardcode secrets.

const { Pushfy } = require('@pushfy/pushfy');

const pushfy = new Pushfy({ apiToken: process.env.PUSHFY_API_TOKEN });

async function main() {
  // `extId` is YOUR reference for the message. Keep it stable and unique so
  // you can later query the delivery status / dedupe safely on retries.
  const result = await pushfy.sms.send({
    to: '5511999999999',            // E.164 digits, no "+"
    text: 'Hello from Pushfy 👋',
    extId: 'welcome-001',
  });

  // The API returns an array: [{ id, phone, date, ext_id }]
  console.log('Accepted:', result);
}

main().catch((err) => {
  console.error('Send failed:', err.status, err.code, err.message);
  process.exitCode = 1;
});
