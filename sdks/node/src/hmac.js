'use strict';

const crypto = require('crypto');

/**
 * Builds the canonical string and HMAC-SHA256 signature used by the Pushfy V2
 * API (Push server + Conversational AI). Must match the server exactly:
 *
 *   base      = timestamp + "\n" + METHOD + "\n" + path + "\n" + sha256hex(body)
 *   signature = hex( HMAC-SHA256(base, secret) )
 *
 * `path` is the route only (e.g. "/v1/conversations"), without the query string.
 */
function sign({ method, path, body = '', secret, timestamp }) {
  const ts = String(timestamp || Math.floor(Date.now() / 1000));
  const bodyHash = crypto.createHash('sha256').update(body || '', 'utf8').digest('hex');
  const base = `${ts}\n${String(method).toUpperCase()}\n${path}\n${bodyHash}`;
  const signature = crypto.createHmac('sha256', secret).update(base, 'utf8').digest('hex');
  return { timestamp: ts, signature };
}

module.exports = { sign };
