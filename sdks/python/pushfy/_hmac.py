"""HMAC-SHA256 request signing for the Pushfy V2 API.

Builds the canonical string and signature used by the Pushfy V2 API
(Push server + Conversational AI). Must match the server exactly::

    base      = timestamp + "\\n" + METHOD + "\\n" + path + "\\n" + sha256hex(body)
    signature = hex( HMAC-SHA256(base, secret) )

``path`` is the route only (e.g. ``/v1/conversations``), without the query string.
"""

import hashlib
import hmac as _hmac
import time


def sign(method, path, secret, body="", timestamp=None):
    """Sign a V2 request.

    :param method: HTTP method (case-insensitive).
    :param path: Route only, e.g. ``/v1/conversations`` (no query string).
    :param secret: HMAC secret (``pas_...`` / ``pss_...``).
    :param body: Raw request body string (``""`` for GET/empty).
    :param timestamp: Optional unix seconds; defaults to now.
    :returns: ``(timestamp, signature)`` where both are strings.
    """
    ts = str(timestamp if timestamp is not None else int(time.time()))
    body_bytes = (body or "").encode("utf-8")
    body_hash = hashlib.sha256(body_bytes).hexdigest()
    base = "{ts}\n{method}\n{path}\n{body_hash}".format(
        ts=ts, method=str(method).upper(), path=path, body_hash=body_hash
    )
    signature = _hmac.new(
        secret.encode("utf-8"), base.encode("utf-8"), hashlib.sha256
    ).hexdigest()
    return ts, signature
