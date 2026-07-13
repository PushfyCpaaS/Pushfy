/**
 * Minimal example: send a single SMS.
 *
 * Run (after `npm run build`):
 *   PUSHFY_API_TOKEN=xxxx npx ts-node examples/send-sms.ts
 *
 * Requires Node.js 18+ (uses the built-in fetch).
 */
import { Pushfy, RateLimitError, AuthenticationError, ApiError } from '@pushfy/pushfy';
// During local development against the source, use instead:
// import { Pushfy, RateLimitError, AuthenticationError, ApiError } from '../src/index';

async function main(): Promise<void> {
  const pushfy = new Pushfy({
    apiToken: process.env.PUSHFY_API_TOKEN || 'YOUR_API_TOKEN', // placeholder — no secrets
  });

  try {
    const result = await pushfy.sms.send({
      to: '5511999999999',
      text: 'Hello from Pushfy 👋',
      extId: 'welcome-001',
    });
    console.log('sent:', result); // [{ id, phone, date, ext_id }]

    const { raw, balance } = await pushfy.balance.get();
    console.log('balance:', balance, `(raw: ${raw})`);
  } catch (err) {
    if (err instanceof RateLimitError) {
      console.error('rate limited, retry after', err.retryAfter, 's');
    } else if (err instanceof AuthenticationError) {
      console.error('bad token:', err.status, err.code);
    } else if (err instanceof ApiError) {
      console.error('server/network error — safe to retry with the same extId');
    } else {
      throw err;
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
