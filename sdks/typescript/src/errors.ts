/**
 * Metadata attached to every {@link PushfyError}.
 */
export interface PushfyErrorMeta {
  /** HTTP status (0 for network/timeout). */
  status?: number;
  /** API error string (e.g. "unauthorized", "rate_limited"). */
  code?: string | null;
  /** Parsed response body. */
  response?: unknown;
  /** Seconds to wait before retrying (RateLimitError only). */
  retryAfter?: number | null;
}

/**
 * Base error for every failure surfaced by the SDK.
 * `status` is the HTTP status (0 for network/timeout), `code` is the API error
 * string (e.g. "unauthorized", "rate_limited"), `response` is the parsed body.
 */
export class PushfyError extends Error {
  status: number;
  code: string | null;
  response: unknown;

  constructor(message: string, { status = 0, code = null, response = null }: PushfyErrorMeta = {}) {
    super(message);
    this.name = 'PushfyError';
    this.status = status;
    this.code = code;
    this.response = response;
    // Restore prototype chain (TS target < ES2015 interop / extending built-ins).
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** 401 / 403 — missing/invalid token or bad HMAC signature. */
export class AuthenticationError extends PushfyError {
  constructor(message: string, meta?: PushfyErrorMeta) {
    super(message, meta);
    this.name = 'AuthenticationError';
  }
}

/** 400/413/415 — the request was malformed. */
export class InvalidRequestError extends PushfyError {
  constructor(message: string, meta?: PushfyErrorMeta) {
    super(message, meta);
    this.name = 'InvalidRequestError';
  }
}

/** 429 — rate limited. `retryAfter` is seconds, when known. */
export class RateLimitError extends PushfyError {
  retryAfter: number | null;
  constructor(message: string, meta: PushfyErrorMeta = {}) {
    super(message, meta);
    this.name = 'RateLimitError';
    this.retryAfter = meta.retryAfter || null;
  }
}

/** 5xx / network / timeout — safe to retry (idempotently). */
export class ApiError extends PushfyError {
  constructor(message: string, meta?: PushfyErrorMeta) {
    super(message, meta);
    this.name = 'ApiError';
  }
}

/** Shape of an error body parsed from the API. */
export interface ApiErrorBody {
  error?: unknown;
  code?: unknown;
  [key: string]: unknown;
}

/** Maps an HTTP status + parsed body to the right error class. */
export function errorFromResponse(status: number, body: ApiErrorBody): PushfyError {
  const code = body && (body.error || body.code) ? String(body.error || body.code) : null;
  const msg = code ? `Pushfy API error: ${code}` : `Pushfy API error (HTTP ${status})`;
  const meta: PushfyErrorMeta = { status, code, response: body };
  if (status === 401 || status === 403) return new AuthenticationError(msg, meta);
  if (status === 429) return new RateLimitError('Rate limited', meta);
  if (status >= 400 && status < 500) return new InvalidRequestError(msg, meta);
  return new ApiError(msg, meta);
}
