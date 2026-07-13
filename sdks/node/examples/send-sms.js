'use strict';

// Send an SMS with the Pushfy Node SDK.
//   node examples/send-sms.js
// Requires PUSHFY_API_TOKEN in your environment.

const { Pushfy, RateLimitError } = require('../src');

async function main() {
  const pushfy = new Pushfy({ apiToken: process.env.PUSHFY_API_TOKEN });

  try {
    const result = await pushfy.sms.send({
      to: '5511999999999',
      text: 'Hello from the Pushfy Node SDK 👋',
      extId: 'demo-' + Date.now(),
    });
    console.log('Accepted:', result);
  } catch (err) {
    if (err instanceof RateLimitError) console.error('Rate limited — back off and retry.');
    else console.error('Failed:', err.status, err.code, err.response);
    process.exit(1);
  }
}

main();
