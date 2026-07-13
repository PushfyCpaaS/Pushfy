"""Typed errors raised by the Pushfy SDK."""


class PushfyError(Exception):
    """Base error for every failure surfaced by the SDK.

    ``status`` is the HTTP status (0 for network/timeout), ``code`` is the API
    error string (e.g. ``"unauthorized"``, ``"rate_limited"``), and ``response``
    is the parsed body.
    """

    def __init__(self, message, status=0, code=None, response=None):
        super().__init__(message)
        self.message = message
        self.status = status
        self.code = code
        self.response = response


class AuthenticationError(PushfyError):
    """401/403 -- missing/invalid token or bad HMAC signature."""


class InvalidRequestError(PushfyError):
    """400/413/415 -- the request was malformed."""


class RateLimitError(PushfyError):
    """429 -- rate limited. ``retry_after`` is seconds, when known."""

    def __init__(self, message, status=0, code=None, response=None, retry_after=None):
        super().__init__(message, status=status, code=code, response=response)
        self.retry_after = retry_after


class ApiError(PushfyError):
    """5xx / network / timeout -- safe to retry (idempotently)."""


def error_from_response(status, body):
    """Map an HTTP status + parsed body to the right error class."""
    code = None
    if isinstance(body, dict) and (body.get("error") or body.get("code")):
        code = str(body.get("error") or body.get("code"))
    msg = (
        "Pushfy API error: {code}".format(code=code)
        if code
        else "Pushfy API error (HTTP {status})".format(status=status)
    )
    if status in (401, 403):
        return AuthenticationError(msg, status=status, code=code, response=body)
    if status == 429:
        retry_after = None
        if isinstance(body, dict):
            retry_after = body.get("retry_after") or body.get("retryAfter")
        return RateLimitError(
            "Rate limited", status=status, code=code, response=body, retry_after=retry_after
        )
    if 400 <= status < 500:
        return InvalidRequestError(msg, status=status, code=code, response=body)
    return ApiError(msg, status=status, code=code, response=body)
