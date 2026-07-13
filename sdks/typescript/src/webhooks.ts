import { createHmac, timingSafeEqual } from 'crypto';

/** Signature encoding scheme. `raw` = bare hex (X-PA-Signature). */
export type WebhookScheme = 'prefixed' | 'raw';

/** Parameters for {@link verify}. */
export interface VerifyParams {
  /** Raw request body (exact bytes received). */
  payload: string | Uint8Array | Buffer;
  /** Value of the signature header. */
  signature: string | null | undefined;
  /** Your webhook secret. */
  secret: string;
  /** 'raw' for X-PA-Signature; defaults to 'prefixed' (sha256=<hex>). */
  scheme?: WebhookScheme;
}

/** Parameters for the per-product helpers (scheme is fixed). */
export type ProductVerifyParams = Omit<VerifyParams, 'scheme'>;

/**
 * Verifies the authenticity of an incoming Pushfy webhook.
 *
 * Signature header differs by product:
 *   - Messaging status   -> X-Pushfy-Signature: sha256=<hex>   (scheme: 'prefixed')
 *   - Push Notifications -> X-Push-Signature:   sha256=<hex>   (scheme: 'prefixed')
 *   - Conversational AI  -> X-PA-Signature:      <hex>          (scheme: 'raw')
 *
 * Always pass the RAW request body (the exact bytes received), not a
 * re-serialized object — re-serialization changes the signature.
 *
 * @returns true when the signature is valid.
 */
export function verify({ payload, signature, secret, scheme = 'prefixed' }: VerifyParams): boolean {
  if (!signature || !secret) return false;
  const body = Buffer.isBuffer(payload)
    ? payload
    : Buffer.from(typeof payload === 'string' ? payload : (payload as Uint8Array));
  const hex = createHmac('sha256', secret).update(body).digest('hex');
  const expected = scheme === 'raw' ? hex : `sha256=${hex}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Verify a Messaging status/DLR webhook (X-Pushfy-Signature: sha256=<hex>). */
export const messaging = (opts: ProductVerifyParams): boolean => verify({ ...opts, scheme: 'prefixed' });

/** Verify a Push Notifications webhook (X-Push-Signature: sha256=<hex>). */
export const push = (opts: ProductVerifyParams): boolean => verify({ ...opts, scheme: 'prefixed' });

/** Verify a Conversational AI webhook (X-PA-Signature: raw hex). */
export const conversations = (opts: ProductVerifyParams): boolean => verify({ ...opts, scheme: 'raw' });

/** Namespaced export mirroring the Node SDK's `Pushfy.webhooks`. */
export const webhooks = { verify, messaging, push, conversations };
