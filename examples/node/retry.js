'use strict';

// Idempotent retry with exponential backoff + jitter.
//
// Run:  PUSHFY_API_TOKEN=... node retry.js
//
// Key rules:
//   - Only retry TRANSIENT failures: 5xx / network / timeout (ApiError) and 429
//     (RateLimitError). Never retry 4xx like auth/invalid — they won't recover.
//   - Stay IDEMPOTENT: reuse the SAME extId on every attempt so a message that
//     actually went through on a "failed" attempt is not sent (or charged) twice.

const { Pushfy, RateLimitError, ApiError } = require('@pushfy/pushfy');

const pushfy = new Pushfy({ apiToken: process.env.PUSHFY_API_TOKEN });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function isRetryable(err) {
  // ApiError covers 5xx + network + timeout (status 0). RateLimitError is 429.
  return err instanceof ApiError || err instanceof RateLimitError;
}

async function withRetry(fn, { retries = 5, baseMs = 500, maxMs = 30000 } = {}) {
  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (err) {
      if (!isRetryable(err) || attempt >= retries) throw err;

      // Honor Retry-After on 429 when present; otherwise exponential backoff.
      let delay = Math.min(maxMs, baseMs * 2 ** attempt);
      if (err instanceof RateLimitError && err.retryAfter) {
        delay = Math.max(delay, err.retryAfter * 1000);
      }
      delay += Math.floor(Math.random() * 250); // jitter to avoid thundering herd

      attempt += 1;
      console.warn(`Attempt ${attempt} failed (${err.status}); retrying in ${delay}ms`);
      await sleep(delay);
    }
  }
}

async function main() {
  // extId is fixed outside the retry loop → every attempt is idempotent.
  const extId = 'order-2042-confirmation';

  const result = await withRetry(() =>
    pushfy.sms.send({
      to: '5511999999999',
      text: 'Your order #2042 is confirmed ✅',
      extId,
    })
  );

  console.log('Delivered to API:', result);
}

main().catch((err) => {
  console.error('Gave up:', err.status, err.code, err.message);
  process.exitCode = 1;
});
