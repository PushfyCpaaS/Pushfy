'use strict';

// Send an RCS rich card (title, image, tappable button).
//
// Run:  PUSHFY_API_TOKEN=... node send-rcs.js

const { Pushfy } = require('@pushfy/pushfy');

const pushfy = new Pushfy({ apiToken: process.env.PUSHFY_API_TOKEN });

async function main() {
  const result = await pushfy.rcs.send({
    to: '5511999999999',
    title: 'Order shipped',
    text: 'Your order #1042 is on the way 🚚',
    image: 'https://cdn.example.com/box.jpg', // hosted image URL
    url: 'https://example.com/track/1042',    // where the button links to
    cta: 'Track order',                        // button label
    extId: 'order-1042-shipped',
  });

  console.log('Accepted:', result);
}

main().catch((err) => {
  console.error('RCS send failed:', err.status, err.code, err.message);
  process.exitCode = 1;
});
