'use strict';

const crypto = require('crypto');

/**
 * Verifies the authenticity of an incoming Pushfy webhook.
 *
 * Signature header differs by product:
 *   - Messaging status  -> X-Pushfy-Signature: sha256=<hex>   (scheme: 'prefixed')
 *   - Push Notifications -> X-Push-Signature:   sha256=<hex>   (scheme: 'prefixed')
 *   - Conversational AI  -> X-PA-Signature:      <hex>          (scheme: 'raw')
 *
 * Always pass the RAW request body (the exact bytes received), not a
 * re-serialized object — re-serialization changes the signature.
 *
 * @param {object}  opts
 * @param {string|Buffer} opts.payload   Raw request body.
 * @param {string}  opts.signature       Value of the signature header.
 * @param {string}  opts.secret          Your webhook secret.
 * @param {'prefixed'|'raw'} [opts.scheme='prefixed']  'raw' for X-PA-Signature.
 * @returns {boolean} true when the signature is valid.
 */
function verify({ payload, signature, secret, scheme = 'prefixed' }) {
  if (!signature || !secret) return false;
  const body = Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload), 'utf8');
  const hex = crypto.createHmac('sha256', secret).update(body).digest('hex');
  const expected = scheme === 'raw' ? hex : `sha256=${hex}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Convenience wrappers per product. */
const messaging = (opts) => verify({ ...opts, scheme: 'prefixed' });
const push = (opts) => verify({ ...opts, scheme: 'prefixed' });
const conversations = (opts) => verify({ ...opts, scheme: 'raw' });

module.exports = { verify, messaging, push, conversations };
