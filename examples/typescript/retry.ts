/**
 * retry.ts — Idempotent send with exponential backoff + jitter.
 *
 * Retry ONLY on transient failures (5xx / network via ApiError, and 429 via
 * RateLimitError honouring `retryAfter`). Never retry InvalidRequestError or
 * AuthenticationError — the request will keep failing.
 *
 * Idempotency: reuse the SAME `extId` on every attempt. Pushfy dedupes by
 * ext_id, so a retry after a timeout will not double-charge.
 *
 * Run:  PUSHFY_API_TOKEN=... npx ts-node retry.ts
 */
import {
  Pushfy,
  ApiError,
  RateLimitError,
  MessageSendResult,
} from '@pushfy/pushfy';

interface RetryOptions {
  retries?: number;   // max additional attempts after the first
  baseMs?: number;    // initial backoff
  maxMs?: number;     // cap per-attempt delay
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * Run `fn` with exponential backoff. `fn` MUST be idempotent (stable extId).
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  { retries = 4, baseMs = 500, maxMs = 15_000 }: RetryOptions = {},
): Promise<T> {
  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (err: unknown) {
      const retryable = err instanceof ApiError || err instanceof RateLimitError;
      if (!retryable || attempt >= retries) throw err;

      // Prefer the server's Retry-After when rate limited.
      const backoff =
        err instanceof RateLimitError && err.retryAfter
          ? err.retryAfter * 1000
          : Math.min(maxMs, baseMs * 2 ** attempt);
      const jitter = Math.floor(Math.random() * (backoff / 2)); // full-ish jitter
      const delay = backoff + jitter;

      attempt += 1;
      console.warn(`Attempt ${attempt} failed (${(err as Error).message}). Retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }
}

async function main(): Promise<void> {
  const apiToken = process.env.PUSHFY_API_TOKEN;
  if (!apiToken) throw new Error('Set PUSHFY_API_TOKEN in the environment.');

  const pushfy = new Pushfy({ apiToken });

  // Stable extId => safe to retry.
  const extId = 'retry-demo-001';

  const result: MessageSendResult = await withRetry(() =>
    pushfy.sms.send({ to: '5511999999999', text: 'Reliable delivery', extId }),
  );

  console.log('Sent after retry logic:', JSON.stringify(result, null, 2));
}

main().catch((err: unknown) => {
  console.error('Gave up:', err instanceof Error ? err.message : err);
  process.exit(1);
});
