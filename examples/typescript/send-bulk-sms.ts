/**
 * send-bulk-sms.ts — Send many SMS in a single request.
 *
 * Run:  PUSHFY_API_TOKEN=... npx ts-node send-bulk-sms.ts
 */
import { Pushfy, SmsBulkItem, MessageSendResult } from '@pushfy/pushfy';

async function main(): Promise<void> {
  const apiToken = process.env.PUSHFY_API_TOKEN;
  if (!apiToken) throw new Error('Set PUSHFY_API_TOKEN in the environment.');

  const pushfy = new Pushfy({ apiToken });

  const messages: SmsBulkItem[] = [
    { to: '5511999999999', text: 'Hi Ana',   extId: 'bulk-ana-001' },
    { to: '5511999999999', text: 'Hi Bruno', extId: 'bulk-bruno-001' },
    { to: '5511999999999', text: 'Hi Carla', extId: 'bulk-carla-001' },
  ];

  const result: MessageSendResult = await pushfy.sms.sendBulk(messages);

  console.log(`Accepted ${result.length} message(s).`);
  for (const item of result) {
    console.log(`  ${item.ext_id ?? '(no ext_id)'} -> id=${item.id ?? '?'} phone=${item.phone ?? '?'}`);
  }
}

main().catch((err: unknown) => {
  console.error('Failed to send bulk SMS:', err instanceof Error ? err.message : err);
  process.exit(1);
});
