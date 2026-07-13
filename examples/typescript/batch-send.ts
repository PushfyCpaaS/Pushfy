/**
 * batch-send.ts — Send a large list of SMS by splitting into chunks.
 *
 * Sending thousands of destinations in a single request is fragile: instead we
 * split into fixed-size chunks and send them with bounded concurrency, so a
 * failure only affects one chunk and you stay within request-size limits.
 *
 * Run:  PUSHFY_API_TOKEN=... npx ts-node batch-send.ts
 */
import { Pushfy, SmsBulkItem, MessageSendResult } from '@pushfy/pushfy';

/** Split an array into chunks of `size`. */
function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Run async `worker` over `items` with at most `limit` running at once. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function runner(): Promise<void> {
    for (;;) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await worker(items[i], i);
    }
  }
  const runners = Array.from({ length: Math.min(limit, items.length) }, runner);
  await Promise.all(runners);
  return results;
}

async function main(): Promise<void> {
  const apiToken = process.env.PUSHFY_API_TOKEN;
  if (!apiToken) throw new Error('Set PUSHFY_API_TOKEN in the environment.');

  const pushfy = new Pushfy({ apiToken });

  // Build a demo audience. In real life this comes from your DB/CSV.
  const audience: SmsBulkItem[] = Array.from({ length: 2500 }, (_, i) => ({
    to: '5511999999999',
    text: 'Your statement is ready.',
    extId: `statement-${String(i).padStart(5, '0')}`, // stable => idempotent
  }));

  const CHUNK_SIZE = 500;   // destinations per request
  const CONCURRENCY = 3;    // chunks in flight at once

  const chunks = chunk(audience, CHUNK_SIZE);
  console.log(`Sending ${audience.length} messages in ${chunks.length} chunk(s)...`);

  let accepted = 0;
  const failures: Array<{ chunk: number; error: string }> = [];

  await mapWithConcurrency(chunks, CONCURRENCY, async (batch, idx) => {
    try {
      const result: MessageSendResult = await pushfy.sms.sendBulk(batch);
      accepted += result.length;
      console.log(`  chunk ${idx + 1}/${chunks.length}: accepted ${result.length}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      failures.push({ chunk: idx, error: message });
      console.error(`  chunk ${idx + 1}/${chunks.length} FAILED: ${message}`);
    }
  });

  console.log(`Done. Accepted ${accepted}, failed chunks: ${failures.length}.`);
  // Re-send failed chunks safely later — the stable extIds make it idempotent.
  if (failures.length) process.exitCode = 1;
}

main().catch((err: unknown) => {
  console.error('Batch send failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
