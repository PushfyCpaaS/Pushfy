'use strict';

// Send thousands of SMS by chunking the list and calling sendBulk() per chunk.
//
// Run:  PUSHFY_API_TOKEN=... node batch-send.js
//
// Strategy:
//   - Split the audience into fixed-size chunks (e.g. 500) — one API call each.
//   - Give every message a stable, unique extId (here derived from the row id)
//     so the whole batch is safe to re-run after a partial failure.
//   - Add a small pause between chunks to stay under rate limits.

const { Pushfy, RateLimitError } = require('@pushfy/pushfy');

const pushfy = new Pushfy({ apiToken: process.env.PUSHFY_API_TOKEN });

const CHUNK_SIZE = 500;
const PAUSE_MS = 250;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function* chunk(arr, size) {
  for (let i = 0; i < arr.length; i += size) yield arr.slice(i, i + size);
}

// Pretend this comes from your database. Each recipient has a stable id.
function buildAudience(n) {
  const rows = [];
  for (let i = 1; i <= n; i++) {
    rows.push({
      id: i,
      to: '5511999999999',
      text: `Reminder #${i}: your appointment is tomorrow`,
      extId: `reminder-2026-07-13-${i}`, // stable → idempotent re-run
    });
  }
  return rows;
}

async function main() {
  const audience = buildAudience(2500);
  let sent = 0;

  for (const batch of chunk(audience, CHUNK_SIZE)) {
    const payload = batch.map((r) => ({ to: r.to, text: r.text, extId: r.extId }));

    // Retry THIS chunk on rate limits — same extIds make the resend idempotent.
    for (;;) {
      try {
        const res = await pushfy.sms.sendBulk(payload);
        sent += res.length;
        console.log(`Chunk accepted: ${res.length} (total ${sent}/${audience.length})`);
        break;
      } catch (err) {
        if (err instanceof RateLimitError) {
          const wait = (err.retryAfter || 2) * 1000;
          console.warn(`Rate limited; waiting ${wait}ms then retrying chunk`);
          await sleep(wait);
          continue;
        }
        throw err; // 4xx/auth: fix the payload — do not loop forever
      }
    }
    await sleep(PAUSE_MS);
  }

  console.log(`Done. ${sent} message(s) accepted.`);
}

main().catch((err) => {
  console.error('Batch failed:', err.status, err.code, err.message);
  process.exitCode = 1;
});
