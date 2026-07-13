/**
 * Smoke test for @pushfy/pushfy (TypeScript).
 *
 * Mirrors the Node SDK's 7 checks, using a mocked fetch (no network, no secrets):
 *   1. HMAC signing matches the canonical recipe.
 *   2. sms.send produces the right body shape + Bearer auth.
 *   3. balance.get parses "1.500" -> 1500.
 *   4. conversations.* send X-PA-* headers with a valid signature.
 *   5. push.* send X-PUSH-* headers with a valid signature.
 *   6. webhook verify: raw (bare hex) vs prefixed (sha256=).
 *   7. a 401 response is mapped to AuthenticationError.
 *
 * Run: `npm run smoke`  (compiles with tsconfig.smoke.json, then runs on node).
 */
import { createHash, createHmac } from 'crypto';
import {
  Pushfy,
  sign,
  webhooks,
  AuthenticationError,
  FetchInit,
  FetchLike,
  FetchResponse,
} from '../src/index';

// --- tiny test harness -----------------------------------------------------

let passed = 0;
const failures: string[] = [];
function check(name: string, cond: boolean): void {
  if (cond) {
    passed++;
    console.log(`  ok  - ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL- ${name}`);
  }
}

// --- mocked fetch ----------------------------------------------------------

interface MockResponseSpec {
  status?: number;
  body?: string;
}
interface Captured {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
}

let handler: (url: string, init?: FetchInit) => MockResponseSpec = () => ({ status: 200, body: '{}' });
const calls: Captured[] = [];

const mockFetch: FetchLike = (url, init) => {
  const bodyRaw = init && init.body;
  calls.push({
    url,
    method: (init && init.method) || 'GET',
    headers: (init && init.headers) || {},
    body: typeof bodyRaw === 'string' ? bodyRaw : '',
  });
  const spec = handler(url, init);
  const status = spec.status ?? 200;
  const res: FetchResponse = {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(spec.body ?? ''),
  };
  return Promise.resolve(res);
};

function lastCall(): Captured {
  return calls[calls.length - 1];
}

// --- client under test (placeholder creds only) ----------------------------

const client = new Pushfy({
  apiToken: 'test_token',
  paKey: 'pak_test',
  paSecret: 'pas_secret',
  pushKey: 'pushk_test',
  pushSecret: 'pss_secret',
  appId: 'pushapp_test',
  fetch: mockFetch,
});

async function main(): Promise<void> {
  console.log('Pushfy TypeScript SDK — smoke test\n');

  // --- Check 1: HMAC recipe -------------------------------------------------
  {
    const method = 'POST';
    const route = '/v1/conversations';
    const body = JSON.stringify({ hello: 'world' });
    const timestamp = '1700000000';
    const bodyHash = createHash('sha256').update(body, 'utf8').digest('hex');
    const base = `${timestamp}\n${method}\n${route}\n${bodyHash}`;
    const expected = createHmac('sha256', 'pas_secret').update(base, 'utf8').digest('hex');
    const got = sign({ method, path: route, body, secret: 'pas_secret', timestamp });
    check('1. HMAC signature matches the canonical recipe', got.signature === expected && got.timestamp === timestamp);
  }

  // --- Check 2: sms.send shape + Bearer ------------------------------------
  {
    handler = () => ({ status: 200, body: JSON.stringify([{ id: 1, phone: '5511999999999', ext_id: 'ref-1' }]) });
    const res = await client.sms.send({ to: '+55 (11) 99999-9999', text: 'Hi', extId: 'ref-1' });
    const c = lastCall();
    const parsedBody = JSON.parse(c.body);
    const msg = parsedBody.messages && parsedBody.messages[0];
    check(
      '2. sms.send posts /webapi with correct shape + Bearer',
      c.method === 'POST' &&
        c.url.endsWith('/webapi') &&
        c.headers['Authorization'] === 'Bearer test_token' &&
        c.headers['Content-Type'] === 'application/json' &&
        !!msg &&
        msg.destinations[0].to === '5511999999999' && // non-digits stripped
        msg.text === 'Hi' &&
        msg.ext_id === 'ref-1' &&
        Array.isArray(res) &&
        res[0].id === 1,
    );
  }

  // --- Check 3: balance parse ----------------------------------------------
  {
    handler = () => ({ status: 200, body: JSON.stringify({ saldo: '1.500' }) });
    const bal = await client.balance.get();
    check('3. balance.get parses "1.500" -> 1500', bal.raw === '1.500' && bal.balance === 1500);
  }

  // --- Check 4: X-PA-* headers + valid signature ---------------------------
  {
    handler = () => ({ status: 200, body: '{}' });
    await client.conversations.open({ userExtId: 'user-42', name: 'Ana', channel: 'webchat' });
    const c = lastCall();
    const ts = c.headers['X-PA-Timestamp'];
    const expected = sign({ method: 'POST', path: '/v1/conversations', body: c.body, secret: 'pas_secret', timestamp: ts }).signature;
    check(
      '4. conversations.* sends valid X-PA-* headers',
      c.headers['X-PA-Key'] === 'pak_test' &&
        !!ts &&
        c.headers['X-PA-Signature'] === expected &&
        c.url.includes('r=%2Fv1%2Fconversations'),
    );
  }

  // --- Check 5: X-PUSH-* headers + valid signature -------------------------
  {
    handler = () => ({ status: 200, body: JSON.stringify({ id: 'camp_1' }) });
    await client.push.campaigns.create({ name: 'Promo', title: 'Sale!', body: '50% off' });
    const c = lastCall();
    const ts = c.headers['X-PUSH-Timestamp'];
    const expected = sign({ method: 'POST', path: '/v1/push/campaigns', body: c.body, secret: 'pss_secret', timestamp: ts }).signature;
    check(
      '5. push.* sends valid X-PUSH-* headers',
      c.headers['X-PUSH-Key'] === 'pushk_test' &&
        !!ts &&
        c.headers['X-PUSH-Signature'] === expected,
    );
  }

  // --- Check 6: webhook raw vs prefixed ------------------------------------
  {
    const secret = 'whsec_test';
    const payload = JSON.stringify({ event: 'delivered', id: 'm1' });
    const hex = createHmac('sha256', secret).update(Buffer.from(payload, 'utf8')).digest('hex');
    const prefixed = `sha256=${hex}`;

    const prefixedOk = webhooks.messaging({ payload, signature: prefixed, secret }) &&
      webhooks.push({ payload, signature: prefixed, secret });
    const prefixedRejectsRaw = !webhooks.messaging({ payload, signature: hex, secret });
    const rawOk = webhooks.conversations({ payload, signature: hex, secret });
    const rawRejectsPrefixed = !webhooks.conversations({ payload, signature: prefixed, secret });

    check(
      '6. webhook verify: prefixed (sha256=) vs raw hex schemes',
      prefixedOk && prefixedRejectsRaw && rawOk && rawRejectsPrefixed,
    );
  }

  // --- Check 7: 401 -> AuthenticationError ---------------------------------
  {
    handler = () => ({ status: 401, body: JSON.stringify({ error: 'unauthorized' }) });
    let caught: unknown = null;
    try {
      await client.sms.send({ to: '5511999999999', text: 'Hi' });
    } catch (e) {
      caught = e;
    }
    const authErr = caught instanceof AuthenticationError;
    check(
      '7. a 401 response maps to AuthenticationError',
      authErr && (caught as AuthenticationError).status === 401 && (caught as AuthenticationError).code === 'unauthorized',
    );
  }

  // --- summary --------------------------------------------------------------
  console.log(`\n${passed}/${passed + failures.length} checks passed.`);
  if (failures.length) {
    console.error('Failures:', failures.join(', '));
    process.exit(1);
  }
  console.log('All smoke checks passed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
