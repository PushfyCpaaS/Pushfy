import { createHash, createHmac } from 'crypto';

/** Parameters for {@link sign}. */
export interface SignParams {
  /** HTTP method (e.g. "POST"). */
  method: string;
  /** Route only (e.g. "/v1/conversations"), without the query string. */
  path: string;
  /** Serialized request body (empty string for GET/DELETE). */
  body?: string;
  /** HMAC secret (pas_... or pss_...). */
  secret: string;
  /** Unix seconds; defaults to now. Override only for tests. */
  timestamp?: string | number;
}

/** Result of {@link sign}: the timestamp used and the hex signature. */
export interface SignResult {
  timestamp: string;
  signature: string;
}

/**
 * Builds the canonical string and HMAC-SHA256 signature used by the Pushfy V2
 * API (Push server + Conversational AI). Must match the server exactly:
 *
 *   base      = timestamp + "\n" + METHOD + "\n" + path + "\n" + sha256hex(body)
 *   signature = hex( HMAC-SHA256(base, secret) )
 *
 * `path` is the route only (e.g. "/v1/conversations"), without the query string.
 */
export function sign({ method, path, body = '', secret, timestamp }: SignParams): SignResult {
  const ts = String(timestamp || Math.floor(Date.now() / 1000));
  const bodyHash = createHash('sha256').update(body || '', 'utf8').digest('hex');
  const base = `${ts}\n${String(method).toUpperCase()}\n${path}\n${bodyHash}`;
  const signature = createHmac('sha256', secret).update(base, 'utf8').digest('hex');
  return { timestamp: ts, signature };
}
