'use strict';

/**
 * Base error for every failure surfaced by the SDK.
 * `status` is the HTTP status (0 for network/timeout), `code` is the API error
 * string (e.g. "unauthorized", "rate_limited"), `response` is the parsed body.
 */
class PushfyError extends Error {
  constructor(message, { status = 0, code = null, response = null } = {}) {
    super(message);
    this.name = 'PushfyError';
    this.status = status;
    this.code = code;
    this.response = response;
  }
}

/** 401 — missing/invalid token or bad HMAC signature. */
class AuthenticationError extends PushfyError {
  constructor(msg, meta) { super(msg, meta); this.name = 'AuthenticationError'; }
}

/** 400/413/415 — the request was malformed. */
class InvalidRequestError extends PushfyError {
  constructor(msg, meta) { super(msg, meta); this.name = 'InvalidRequestError'; }
}

/** 429 — rate limited. `retryAfter` is seconds, when known. */
class RateLimitError extends PushfyError {
  constructor(msg, meta = {}) { super(msg, meta); this.name = 'RateLimitError'; this.retryAfter = meta.retryAfter || null; }
}

/** 5xx / network / timeout — safe to retry (idempotently). */
class ApiError extends PushfyError {
  constructor(msg, meta) { super(msg, meta); this.name = 'ApiError'; }
}

/** Maps an HTTP status + parsed body to the right error class. */
function errorFromResponse(status, body) {
  const code = body && (body.error || body.code) ? String(body.error || body.code) : null;
  const msg = code ? `Pushfy API error: ${code}` : `Pushfy API error (HTTP ${status})`;
  const meta = { status, code, response: body };
  if (status === 401 || status === 403) return new AuthenticationError(msg, meta);
  if (status === 429) return new RateLimitError('Rate limited', meta);
  if (status >= 400 && status < 500) return new InvalidRequestError(msg, meta);
  return new ApiError(msg, meta);
}

module.exports = {
  PushfyError, AuthenticationError, InvalidRequestError, RateLimitError, ApiError, errorFromResponse,
};
