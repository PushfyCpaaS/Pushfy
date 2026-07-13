"""Offline smoke test for the Pushfy Python SDK.

Validates request shaping, HMAC signing and webhook verification without
hitting the network.

Run with either::

    python -m pytest tests/test_smoke.py
    python tests/test_smoke.py
"""

import hashlib
import hmac
import json
import os
import sys

# Make the package importable when run as a plain script.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from pushfy import Pushfy, AuthenticationError, webhooks
from pushfy._hmac import sign
from pushfy.errors import error_from_response


def _mock_transport(response, status=200):
    """Return an ``_http`` replacement that records calls and returns ``response``.

    ``calls`` is attached to the returned function; each entry is a dict with
    ``url``, ``method``, ``headers`` and ``body``.
    """
    calls = []

    def _http(url, method="GET", headers=None, body=None):
        calls.append({"url": url, "method": method, "headers": headers or {}, "body": body})
        if not (200 <= status < 300):
            err_body = response if isinstance(response, dict) else {"error": "error"}
            raise error_from_response(status, err_body)
        return response

    _http.calls = calls
    return _http


def test_hmac_signature_matches_canonical_base():
    ts = 1752345600
    body = '{"user_ext_id":"user-42"}'
    secret = "pas_test"
    _, signature = sign("post", "/v1/conversations", secret, body=body, timestamp=ts)

    body_hash = hashlib.sha256(body.encode("utf-8")).hexdigest()
    base = "{ts}\nPOST\n/v1/conversations\n{bh}".format(ts=ts, bh=body_hash)
    expected = hmac.new(secret.encode("utf-8"), base.encode("utf-8"), hashlib.sha256).hexdigest()
    assert signature == expected


def test_sms_send_shapes_request_and_normalizes_phone():
    transport = _mock_transport([{"id": "x", "phone": "5511999999999", "ext_id": "x"}])
    client = Pushfy(api_token="YOUR_API_TOKEN")
    client._http = transport

    res = client.sms.send(to="+55 (11) 99999-9999", text="Hi", ext_id="x")

    call = transport.calls[0]
    assert call["url"].endswith("/webapi")
    assert call["method"] == "POST"
    assert call["headers"]["Authorization"] == "Bearer YOUR_API_TOKEN"
    sent = json.loads(call["body"])
    assert sent["messages"][0]["destinations"][0]["to"] == "5511999999999"
    assert sent["messages"][0]["text"] == "Hi"
    assert sent["messages"][0]["ext_id"] == "x"
    assert res[0]["ext_id"] == "x"


def test_balance_parses_formatted_string():
    transport = _mock_transport({"saldo": "1.500"})
    client = Pushfy(api_token="t")
    client._http = transport

    assert client.balance.get() == {"raw": "1.500", "balance": 1500}


def test_conversations_open_signs_with_pa_headers():
    transport = _mock_transport({"ok": True, "conversation_id": 1})
    client = Pushfy(pa_key="pak_x", pa_secret="pas_x")
    client._http = transport

    client.conversations.open(user_ext_id="user-42", name="Ana")

    call = transport.calls[0]
    assert "r=%2Fv1%2Fconversations" in call["url"]
    assert call["headers"]["X-PA-Key"] == "pak_x"
    assert call["headers"]["X-PA-Signature"]
    assert call["headers"]["X-PA-Timestamp"]


def test_push_campaign_send_signs_with_push_headers():
    transport = _mock_transport({"ok": True})
    client = Pushfy(push_key="pushk_x", push_secret="pss_x")
    client._http = transport

    client.push.campaigns.send(88)

    call = transport.calls[0]
    assert "r=%2Fv1%2Fpush%2Fcampaigns%2F88%2Fsend" in call["url"]
    assert call["headers"]["X-PUSH-Key"] == "pushk_x"


def test_webhook_verify_raw_vs_prefixed():
    secret = "WEBHOOK_SECRET"
    payload = '{"eid":"evt_1","event":"handoff.requested"}'
    hex_digest = hmac.new(secret.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).hexdigest()

    # Conversational AI: raw hex (X-PA-Signature).
    assert webhooks.conversations(payload=payload, signature=hex_digest, secret=secret) is True
    # Push / messaging: "sha256=" prefix.
    assert webhooks.push(payload=payload, signature="sha256=" + hex_digest, secret=secret) is True
    # Prefixed schemes reject a bare hex signature.
    assert webhooks.push(payload=payload, signature=hex_digest, secret=secret) is False
    # Bad signature rejected.
    assert webhooks.conversations(payload=payload, signature="deadbeef", secret=secret) is False


def test_401_response_raises_authentication_error():
    transport = _mock_transport({"ok": False, "error": "unauthorized"}, status=401)
    client = Pushfy(api_token="bad")
    client._http = transport

    caught = None
    try:
        client.sms.send(to="5511999999999", text="x")
    except AuthenticationError as exc:
        caught = exc
    assert caught is not None
    assert caught.status == 401
    assert caught.code == "unauthorized"


def _run():
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
    for test in tests:
        test()
        print("  ok", test.__name__)
    print("\n{n} checks passed.".format(n=len(tests)))


if __name__ == "__main__":
    _run()
    print("OK")
