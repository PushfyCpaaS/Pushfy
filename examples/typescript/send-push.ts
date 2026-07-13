/**
 * send-push.ts — Create and dispatch a Push Notification campaign (server API).
 *
 * Uses the V2 Push server credentials (HMAC-signed automatically by the SDK).
 *
 * Run:  PUSHFY_PUSH_KEY=... PUSHFY_PUSH_SECRET=... npx ts-node send-push.ts
 */
import { Pushfy, JsonValue } from '@pushfy/pushfy';

/** Narrow the loosely-typed V2 JSON into the id we need. */
function readId(value: JsonValue): string {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const id = (value as Record<string, JsonValue>).id;
    if (typeof id === 'string' || typeof id === 'number') return String(id);
  }
  throw new Error(`Unexpected campaign response: ${JSON.stringify(value)}`);
}

async function main(): Promise<void> {
  const pushKey = process.env.PUSHFY_PUSH_KEY;
  const pushSecret = process.env.PUSHFY_PUSH_SECRET;
  if (!pushKey || !pushSecret) {
    throw new Error('Set PUSHFY_PUSH_KEY and PUSHFY_PUSH_SECRET in the environment.');
  }

  const pushfy = new Pushfy({ pushKey, pushSecret });

  // 1. Create the campaign.
  const created = await pushfy.push.campaigns.create({
    name: 'Weekend Promo',
    title: 'Sale is live! 🎉',
    body: '50% off — this weekend only.',
    url: 'https://example.com/promo',
  });
  const campaignId = readId(created);
  console.log('Created campaign:', campaignId);

  // 2. Dispatch it.
  await pushfy.push.campaigns.send(campaignId);
  console.log('Campaign sent.');

  // 3. Read back delivery metrics.
  const metrics = await pushfy.push.campaigns.metrics(campaignId);
  console.log('Metrics:', JSON.stringify(metrics, null, 2));
}

main().catch((err: unknown) => {
  console.error('Failed to send push:', err instanceof Error ? err.message : err);
  process.exit(1);
});
