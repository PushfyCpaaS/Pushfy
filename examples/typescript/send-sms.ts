/**
 * send-sms.ts — Send a single SMS with Pushfy.
 *
 * Run:  PUSHFY_API_TOKEN=... npx ts-node send-sms.ts
 */
import { Pushfy, MessageSendResult } from '@pushfy/pushfy';

async function main(): Promise<void> {
  const apiToken = process.env.PUSHFY_API_TOKEN;
  if (!apiToken) throw new Error('Set PUSHFY_API_TOKEN in the environment.');

  const pushfy = new Pushfy({ apiToken });

  // extId is YOUR idempotency/reference key — keep it stable so you can
  // query the delivery status later and avoid double-charging on retries.
  const result: MessageSendResult = await pushfy.sms.send({
    to: '5511999999999',
    text: 'Hello from Pushfy 👋',
    extId: 'welcome-001',
  });

  console.log('SMS accepted:', JSON.stringify(result, null, 2));
  // result => [{ id, phone, date, ext_id }]
}

main().catch((err: unknown) => {
  console.error('Failed to send SMS:', err instanceof Error ? err.message : err);
  process.exit(1);
});
