/**
 * error-handling.ts — Branch on typed Pushfy errors with `instanceof`.
 *
 * Every failure throws a subclass of PushfyError, each carrying
 * `status`, `code` and `response`. Handle the specific ones first,
 * then fall back to the generic ApiError (5xx / network).
 *
 * Run:  PUSHFY_API_TOKEN=... npx ts-node error-handling.ts
 */
import {
  Pushfy,
  PushfyError,
  AuthenticationError,
  RateLimitError,
  InvalidRequestError,
  ApiError,
} from '@pushfy/pushfy';

async function main(): Promise<void> {
  const pushfy = new Pushfy({ apiToken: process.env.PUSHFY_API_TOKEN ?? 'invalid-token' });

  try {
    await pushfy.sms.send({
      to: '5511999999999',
      text: 'Hello from Pushfy',
      extId: 'err-demo-001',
    });
    console.log('Sent successfully.');
  } catch (err: unknown) {
    if (err instanceof RateLimitError) {
      // 429 — slow down. err.retryAfter (seconds) may be present.
      console.error(`Rate limited. Retry after ${err.retryAfter ?? '?'}s.`);
    } else if (err instanceof AuthenticationError) {
      // 401/403 — bad token or HMAC keys.
      console.error('Authentication failed — check your credentials.');
    } else if (err instanceof InvalidRequestError) {
      // 400/413/415 — the request itself is wrong; do NOT retry as-is.
      console.error(`Invalid request (${err.status}): ${err.message}`);
    } else if (err instanceof ApiError) {
      // 5xx or network. Safe to retry idempotently (reuse the same extId).
      console.error(`Server/network error (${err.status}). Retry idempotently.`);
    } else if (err instanceof PushfyError) {
      // Any other Pushfy error.
      console.error(`Pushfy error (${err.status}/${err.code}): ${err.message}`);
    } else {
      // Not a Pushfy error at all.
      throw err;
    }

    if (err instanceof PushfyError) {
      console.error('Raw API response:', err.response);
    }
    process.exitCode = 1;
  }
}

main().catch((err: unknown) => {
  console.error('Unhandled error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
