/**
 * send-rcs.ts — Send an RCS rich card (title, text, image, URL and CTA).
 *
 * Run:  PUSHFY_API_TOKEN=... npx ts-node send-rcs.ts
 */
import { Pushfy, RcsSendParams, MessageSendResult } from '@pushfy/pushfy';

async function main(): Promise<void> {
  const apiToken = process.env.PUSHFY_API_TOKEN;
  if (!apiToken) throw new Error('Set PUSHFY_API_TOKEN in the environment.');

  const pushfy = new Pushfy({ apiToken });

  const params: RcsSendParams = {
    to: '5511999999999',
    title: 'Order shipped',
    text: 'Your order #1042 is on the way 🚚',
    image: 'https://cdn.example.com/box.jpg',
    url: 'https://example.com/track/1042',
    cta: 'Track order',
    extId: 'rcs-order-1042',
  };

  const result: MessageSendResult = await pushfy.rcs.send(params);

  console.log('RCS accepted:', JSON.stringify(result, null, 2));
}

main().catch((err: unknown) => {
  console.error('Failed to send RCS:', err instanceof Error ? err.message : err);
  process.exit(1);
});
