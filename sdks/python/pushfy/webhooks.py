"""Verify the authenticity of incoming Pushfy webhooks.

Signature header differs by product::

    - Messaging status   -> X-Pushfy-Signature: sha256=<hex>   (scheme: 'prefixed')
    - Push Notifications  -> X-Push-Signature:   sha256=<hex>   (scheme: 'prefixed')
    - Conversational AI   -> X-PA-Signature:      <hex>          (scheme: 'raw')

Always pass the RAW request body (the exact bytes received), not a
re-serialized object -- re-serialization changes the signature.
"""

import hashlib
import hmac as _hmac


def verify(payload, signature, secret, scheme="prefixed"):
    """Verify a webhook signature.

    :param payload: Raw request body (``str`` or ``bytes``).
    :param signature: Value of the signature header.
    :param secret: Your webhook secret.
    :param scheme: ``'prefixed'`` (``sha256=<hex>``) or ``'raw'`` (bare hex,
        used by ``X-PA-Signature``).
    :returns: ``True`` when the signature is valid.
    """
    if not signature or not secret:
        return False
    body = payload if isinstance(payload, (bytes, bytearray)) else str(payload).encode("utf-8")
    hex_digest = _hmac.new(
        secret.encode("utf-8"), bytes(body), hashlib.sha256
    ).hexdigest()
    expected = hex_digest if scheme == "raw" else "sha256=" + hex_digest
    return _hmac.compare_digest(expected, str(signature))


def messaging(payload, signature, secret):
    """Verify a messaging status/DLR webhook (``X-Pushfy-Signature``, prefixed)."""
    return verify(payload, signature, secret, scheme="prefixed")


def push(payload, signature, secret):
    """Verify a Push Notifications webhook (``X-Push-Signature``, prefixed)."""
    return verify(payload, signature, secret, scheme="prefixed")


def conversations(payload, signature, secret):
    """Verify a Conversational AI webhook (``X-PA-Signature``, raw hex)."""
    return verify(payload, signature, secret, scheme="raw")
