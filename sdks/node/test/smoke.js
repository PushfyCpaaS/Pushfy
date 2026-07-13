'use strict';

// Offline smoke test — validates request shaping, HMAC signing and webhook
// verification without hitting the network. Run: node test/smoke.js
const assert = require('assert');
const crypto = require('crypto');
const { Pushfy } = require('../src');
const { sign } = require('../src/hmac');

let passed = 0;
const ok = (name) => { console.log('  ✓', name); passed++; };

// Records the last request and returns a canned response.
function mockFetch(response) {
  const calls = [];
  const fn = async (url, opts) => {
    calls.push({ url, ...opts });
    return {
      ok: response.ok !== false,
      status: response.status || 200,
      text: async () => (typeof response.body === 'string' ? response.body : JSON.stringify(response.body)),
    };
  };
  fn.calls = calls;
  return fn;
}

(async () => {
  // 1. HMAC signing matches the documented recipe exactly.
  {
    const ts = 1752345600;
    const body = '{"user_ext_id":"user-42"}';
    const secret = 'pas_test';
    const { signature } = sign({ method: 'post', path: '/v1/conversations', body, secret, timestamp: ts });
    const bh = crypto.createHash('sha256').update(body).digest('hex');
    const base = `${ts}\nPOST\n/v1/conversations\n${bh}`;
    const expected = crypto.createHmac('sha256', secret).update(base).digest('hex');
    assert.strictEqual(signature, expected);
    ok('HMAC signature matches canonical base string');
  }

  // 2. sms.send hits /webapi with Bearer auth and the right body.
  {
    const f = mockFetch({ body: [{ id: 'x', phone: '5511999999999', date: '2026-07-12 10:00:00', ext_id: 'x' }] });
    const pushfy = new Pushfy({ apiToken: 'YOUR_API_TOKEN', fetch: f });
    const res = await pushfy.sms.send({ to: '+55 (11) 99999-9999', text: 'Hi', extId: 'x' });
    const call = f.calls[0];
    assert.ok(call.url.endsWith('/webapi'), 'URL is /webapi');
    assert.strictEqual(call.method, 'POST');
    assert.strictEqual(call.headers['Authorization'], 'Bearer YOUR_API_TOKEN');
    const sent = JSON.parse(call.body);
    assert.strictEqual(sent.messages[0].destinations[0].to, '5511999999999', 'phone digits normalized');
    assert.strictEqual(sent.messages[0].text, 'Hi');
    assert.strictEqual(res[0].ext_id, 'x');
    ok('sms.send shapes /webapi request and parses the array response');
  }

  // 3. balance.get parses the formatted string.
  {
    const f = mockFetch({ body: { saldo: '1.500' } });
    const pushfy = new Pushfy({ apiToken: 't', fetch: f });
    const b = await pushfy.balance.get();
    assert.deepStrictEqual(b, { raw: '1.500', balance: 1500 });
    ok('balance.get parses {"saldo":"1.500"} -> 1500');
  }

  // 4. conversations.open signs with X-PA-* headers and routes via ?r=.
  {
    const f = mockFetch({ body: { ok: true, conversation_id: 1, status: 'bot' } });
    const pushfy = new Pushfy({ paKey: 'pak_x', paSecret: 'pas_x', fetch: f });
    await pushfy.conversations.open({ userExtId: 'user-42', name: 'Ana' });
    const call = f.calls[0];
    assert.ok(call.url.includes('r=%2Fv1%2Fconversations'), 'route sent via ?r=');
    assert.ok(call.headers['X-PA-Key'] === 'pak_x', 'X-PA-Key header set');
    assert.ok(call.headers['X-PA-Signature'] && call.headers['X-PA-Timestamp'], 'signature + timestamp set');
    ok('conversations.open signs request with X-PA-* headers');
  }

  // 5. push server call uses X-PUSH-* headers.
  {
    const f = mockFetch({ body: { ok: true } });
    const pushfy = new Pushfy({ pushKey: 'pushk_x', pushSecret: 'pss_x', fetch: f });
    await pushfy.push.campaigns.send(88);
    const call = f.calls[0];
    assert.ok(call.url.includes('r=%2Fv1%2Fpush%2Fcampaigns%2F88%2Fsend'));
    assert.ok(call.headers['X-PUSH-Key'] === 'pushk_x');
    ok('push.campaigns.send signs with X-PUSH-* headers');
  }

  // 6. webhook verification: raw vs prefixed schemes.
  {
    const secret = 'WEBHOOK_SECRET';
    const payload = '{"eid":"evt_1","event":"handoff.requested"}';
    const hex = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    assert.strictEqual(Pushfy.webhooks.conversations({ payload, signature: hex, secret }), true);
    assert.strictEqual(Pushfy.webhooks.push({ payload, signature: `sha256=${hex}`, secret }), true);
    assert.strictEqual(Pushfy.webhooks.push({ payload, signature: hex, secret }), false, 'push requires sha256= prefix');
    assert.strictEqual(Pushfy.webhooks.conversations({ payload, signature: 'deadbeef', secret }), false);
    ok('webhook verify handles raw (X-PA) and prefixed (X-Push/X-Pushfy) schemes');
  }

  // 7. errors: 401 -> AuthenticationError.
  {
    const f = mockFetch({ ok: false, status: 401, body: { ok: false, error: 'unauthorized' } });
    const pushfy = new Pushfy({ apiToken: 'bad', fetch: f });
    let caught;
    try { await pushfy.sms.send({ to: '5511999999999', text: 'x' }); } catch (e) { caught = e; }
    assert.ok(caught && caught.name === 'AuthenticationError' && caught.status === 401);
    ok('401 response throws AuthenticationError');
  }

  console.log(`\n${passed} checks passed.`);
})().catch((e) => { console.error('\nSMOKE TEST FAILED:', e); process.exit(1); });
