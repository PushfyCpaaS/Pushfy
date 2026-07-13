'use strict';

// Branch on typed errors thrown by the SDK.
//
// Run:  PUSHFY_API_TOKEN=... node error-handling.js
//
// Every failure throws a subclass of PushfyError with `.status`, `.code`
// and `.response` populated.

const {
  Pushfy,
  AuthenticationError,
  InvalidRequestError,
  RateLimitError,
  ApiError,
} = require('@pushfy/pushfy');

const pushfy = new Pushfy({ apiToken: process.env.PUSHFY_API_TOKEN });

async function main() {
  try {
    await pushfy.sms.send({
      to: '5511999999999',
      text: 'Hi',
      extId: 'err-demo-001',
    });
    console.log('Sent OK');
  } catch (err) {
    if (err instanceof AuthenticationError) {
      // 401/403 — bad token or HMAC signature. Do NOT retry as-is.
      console.error('Auth error — check your credentials:', err.message);
    } else if (err instanceof InvalidRequestError) {
      // 400/413/415 — malformed request. Fix the payload; retrying won't help.
      console.error('Invalid request:', err.code, err.response);
    } else if (err instanceof RateLimitError) {
      // 429 — back off. retryAfter (seconds) is set when the API provides it.
      console.error(`Rate limited. Retry after ${err.retryAfter || '?'}s`);
    } else if (err instanceof ApiError) {
      // 5xx / network / timeout — safe to retry idempotently (reuse extId).
      // But query status by extId first before resending, to avoid double-charge.
      console.error('Transient API error — retry later:', err.status, err.message);
    } else {
      // Anything unexpected (programmer error, etc.)
      throw err;
    }
    process.exitCode = 1;
  }
}

main();
