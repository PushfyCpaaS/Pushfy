"""Pushfy API client."""

import json as _json
import re
import uuid
from urllib import request as _request, error as _error, parse as _parse

from ._hmac import sign
from .errors import ApiError, error_from_response
from . import webhooks

DEFAULT_BASE = "https://portal.pushfy.com"
DEFAULT_V2_PATH = "/v2/api.php"

_NON_DIGIT = re.compile(r"\D")


def _digits(value):
    return _NON_DIGIT.sub("", str(value))


def _to_message(to=None, text=None, ext_id=None, audio=None):
    out = {"destinations": [{"to": _digits(to)}], "text": text}
    if ext_id is not None:
        out["ext_id"] = ext_id
    if audio is not None:
        out["audio"] = audio
    return out


class Pushfy(object):
    """Pushfy API client.

    Example::

        from pushfy import Pushfy
        pushfy = Pushfy(api_token="YOUR_API_TOKEN")
        res = pushfy.sms.send(to="5511999999999", text="Hello")
    """

    def __init__(
        self,
        api_token=None,
        pa_key=None,
        pa_secret=None,
        push_key=None,
        push_secret=None,
        app_id=None,
        base_url=None,
        v2_path=None,
        timeout=30,
    ):
        """
        :param api_token: Messaging Bearer token.
        :param pa_key: Conversational AI HMAC key (``pak_...``).
        :param pa_secret: Conversational AI HMAC secret (``pas_...``).
        :param push_key: Push server HMAC key (``pushk_...``).
        :param push_secret: Push server HMAC secret (``pss_...``).
        :param app_id: Public Push app id (``pushapp_...``).
        :param base_url: Defaults to https://portal.pushfy.com.
        :param v2_path: V2 API path (default ``/v2/api.php``).
        :param timeout: Request timeout in seconds (default 30).
        """
        self.api_token = api_token
        self.pa_key = pa_key
        self.pa_secret = pa_secret
        self.push_key = push_key
        self.push_secret = push_secret
        self.app_id = app_id
        self.base_url = (base_url or DEFAULT_BASE).rstrip("/")
        self.v2_path = v2_path or DEFAULT_V2_PATH
        self.timeout = timeout

        self.sms = SmsResource(self)
        self.rcs = RcsResource(self)
        self.voice = VoiceResource(self)
        self.messages = MessagesResource(self)
        self.balance = BalanceResource(self)
        self.push = PushResource(self)
        self.conversations = ConversationsResource(self)
        self.events = EventsResource(self)
        self.tasks = TasksResource(self)

    # ---- low-level transport ------------------------------------------------

    def _http(self, url, method="GET", headers=None, body=None):
        """Perform the HTTP request and return the parsed JSON body.

        Raises a typed :class:`~pushfy.errors.PushfyError` on non-2xx responses.
        This is the single seam mocked in tests.
        """
        headers = headers or {}
        data = None
        if body is not None:
            data = body.encode("utf-8") if isinstance(body, str) else body
        req = _request.Request(url, data=data, method=method)
        for key, value in headers.items():
            req.add_header(key, value)
        try:
            resp = _request.urlopen(req, timeout=self.timeout)
            status = resp.getcode()
            text = resp.read().decode("utf-8")
            resp.close()
        except _error.HTTPError as exc:
            status = exc.code
            try:
                text = exc.read().decode("utf-8")
            except Exception:
                text = ""
        except _error.URLError as exc:
            raise ApiError("Network error: {reason}".format(reason=exc.reason), status=0)
        except Exception as exc:  # timeouts and the like
            raise ApiError("Network error: {msg}".format(msg=exc), status=0)

        parsed = None
        if text:
            try:
                parsed = _json.loads(text)
            except ValueError:
                parsed = {"raw": text}

        if not (200 <= status < 300):
            if isinstance(parsed, dict) and not isinstance(parsed, list):
                err_body = parsed if parsed.get("error") else {"error": parsed.get("raw", text)}
            else:
                err_body = {"error": text if isinstance(text, str) else "error"}
            raise error_from_response(status, err_body)
        return parsed

    def _classic(self, method, path, json=None, form=None, query=None):
        """Messaging (classic) request against ``<base_url>/<path>``."""
        url = self.base_url + path
        if query:
            pairs = [(k, v) for k, v in query.items() if v is not None]
            qs = _parse.urlencode(pairs)
            if qs:
                url += ("&" if "?" in path else "?") + qs
        headers = {}
        if self.api_token:
            headers["Authorization"] = "Bearer {t}".format(t=self.api_token)
        body = None
        if form is not None:
            content_type, body = form
            headers["Content-Type"] = content_type
        elif json is not None:
            headers["Content-Type"] = "application/json"
            body = _json.dumps(json)
        return self._http(url, method=method, headers=headers, body=body)

    def _v2(self, method, route, body=None, query=None, auth=None):
        """V2 request (Push / Conversational AI) via ``?r=<route>``."""
        pairs = [("r", route)]
        if query:
            pairs.extend([(k, v) for k, v in query.items() if v is not None])
        url = "{base}{path}?{qs}".format(
            base=self.base_url, path=self.v2_path, qs=_parse.urlencode(pairs)
        )

        body_str = _json.dumps(body) if (body is not None and method != "GET") else ""
        headers = {}
        if body_str:
            headers["Content-Type"] = "application/json"

        if auth == "pa":
            if not self.pa_key or not self.pa_secret:
                raise ValueError("pa_key/pa_secret required for Conversational AI")
            ts, signature = sign(method, route, self.pa_secret, body=body_str)
            headers["X-PA-Key"] = self.pa_key
            headers["X-PA-Timestamp"] = ts
            headers["X-PA-Signature"] = signature
        elif auth == "push":
            if not self.push_key or not self.push_secret:
                raise ValueError("push_key/push_secret required for Push server API")
            ts, signature = sign(method, route, self.push_secret, body=body_str)
            headers["X-PUSH-Key"] = self.push_key
            headers["X-PUSH-Timestamp"] = ts
            headers["X-PUSH-Signature"] = signature

        return self._http(url, method=method, headers=headers, body=body_str or None)

    #: Webhook signature helpers (no credentials needed).
    webhooks = webhooks


# --------------------------------------------------------------------------
# Messaging resources
# --------------------------------------------------------------------------


class SmsResource(object):
    def __init__(self, client):
        self._c = client

    def send(self, to=None, text=None, ext_id=None):
        """Send a single SMS. Returns the API result array."""
        return self._c._classic(
            "POST", "/webapi", json={"messages": [_to_message(to=to, text=text, ext_id=ext_id)]}
        )

    def send_bulk(self, messages=None):
        """Send many SMS in one request. ``messages`` = list of dicts with
        ``to``, ``text`` and optional ``ext_id``."""
        messages = messages or []
        payload = [
            _to_message(to=m.get("to"), text=m.get("text"), ext_id=m.get("ext_id"))
            for m in messages
        ]
        return self._c._classic("POST", "/webapi", json={"messages": payload})


class RcsResource(object):
    def __init__(self, client):
        self._c = client

    def send(self, to=None, title=None, text=None, url=None, cta=None, image=None, ext_id=None):
        """Send an RCS rich card via the API RCS campaign."""
        msg = {"destinations": [{"to": _digits(to)}], "text": text}
        if title:
            msg["title"] = title
        if image:
            msg["image"] = image
        if url:
            msg["url"] = url
        if cta:
            msg["cta"] = cta
        if ext_id is not None:
            msg["ext_id"] = ext_id
        return self._c._classic("POST", "/apircsnativo.php", json={"messages": [msg]})


class VoiceResource(object):
    def __init__(self, client):
        self._c = client

    def upload_audio(self, name=None, data=None, filename="audio.mp3"):
        """Upload a voice audio (.mp3). Returns the API result.

        :param name: Friendly name for the audio.
        :param data: Raw mp3 bytes.
        :param filename: Uploaded filename (default ``audio.mp3``).
        """
        form = _multipart(
            fields={"nome": name or filename},
            files={"audio": (filename, data or b"", "audio/mpeg")},
        )
        return self._c._classic("POST", "/audio", form=form)

    def send(self, to=None, audio_id=None, ext_id=None):
        """Place a voice call referencing a previously uploaded audio id."""
        return self._c._classic(
            "POST",
            "/webapi",
            json={"messages": [_to_message(to=to, text="", ext_id=ext_id, audio=audio_id)]},
        )


class MessagesResource(object):
    def __init__(self, client):
        self._c = client

    def status(self, ext_id=None, uid=None):
        """Delivery status of one message by your ext_id (or internal uid)."""
        return self._c._classic("GET", "/getstatus", query={"ext_id": ext_id, "uid": uid})

    def by_date(self, date):
        """Status of every message on a given day (YYYY-MM-DD)."""
        return self._c._classic("GET", "/getdate", query={"date": date})

    def report(self, date=None, start=None, end=None, event=None, limit=None, offset=None, date_dlr=None):
        """Report by date range."""
        return self._c._classic(
            "GET",
            "/reportbydate",
            query={
                "date": date,
                "start": start,
                "end": end,
                "event": event,
                "limit": limit,
                "offset": offset,
                "date_dlr": date_dlr,
            },
        )


class BalanceResource(object):
    def __init__(self, client):
        self._c = client

    def get(self):
        """SMS balance. Returns ``{"raw": "1.500", "balance": 1500}``."""
        res = self._c._classic("GET", "/balance")
        raw = None
        if isinstance(res, dict) and res.get("saldo") is not None:
            raw = str(res["saldo"])
        balance = int(_digits(raw)) if raw and _digits(raw) else None
        return {"raw": raw, "balance": balance}


# --------------------------------------------------------------------------
# Push Notifications
# --------------------------------------------------------------------------


class _PushDevices(object):
    def __init__(self, client):
        self._c = client

    def list(self, query=None):
        return self._c._v2("GET", "/v1/push/devices", query=query, auth="push")

    def register(self, body):
        return self._c._v2("POST", "/v1/push/devices", body=body, auth="push")

    def remove(self, device_id):
        return self._c._v2("DELETE", "/v1/push/devices/{id}".format(id=device_id), auth="push")


class _PushCampaigns(object):
    def __init__(self, client):
        self._c = client

    def list(self, query=None):
        return self._c._v2("GET", "/v1/push/campaigns", query=query, auth="push")

    def create(self, body):
        return self._c._v2("POST", "/v1/push/campaigns", body=body, auth="push")

    def get(self, campaign_id):
        return self._c._v2("GET", "/v1/push/campaigns/{id}".format(id=campaign_id), auth="push")

    def update(self, campaign_id, body):
        return self._c._v2("PATCH", "/v1/push/campaigns/{id}".format(id=campaign_id), body=body, auth="push")

    def send(self, campaign_id):
        return self._c._v2(
            "POST", "/v1/push/campaigns/{id}/send".format(id=campaign_id), body={}, auth="push"
        )

    def metrics(self, campaign_id):
        return self._c._v2("GET", "/v1/push/campaigns/{id}/metrics".format(id=campaign_id), auth="push")


class _PushSegments(object):
    def __init__(self, client):
        self._c = client

    def list(self, query=None):
        return self._c._v2("GET", "/v1/push/segments", query=query, auth="push")

    def create(self, body):
        return self._c._v2("POST", "/v1/push/segments", body=body, auth="push")


class PushResource(object):
    def __init__(self, client):
        self._c = client
        self.devices = _PushDevices(client)
        self.campaigns = _PushCampaigns(client)
        self.segments = _PushSegments(client)

    def test(self, body):
        """Send a test push."""
        return self._c._v2("POST", "/v1/push/test", body=body, auth="push")

    def subscribe(self, body):
        """Public: subscribe a device (browser/app). Injects app_id automatically."""
        payload = {"app_id": self._c.app_id}
        payload.update(body or {})
        return self._c._v2("POST", "/v1/push/subscribe", body=payload, auth="public")

    def track(self, body):
        """Public: report a device event."""
        payload = {"app_id": self._c.app_id}
        payload.update(body or {})
        return self._c._v2("POST", "/v1/push/track", body=payload, auth="public")


# --------------------------------------------------------------------------
# Conversational AI (PushAgent)
# --------------------------------------------------------------------------


class ConversationsResource(object):
    def __init__(self, client):
        self._c = client

    def open(self, user_ext_id=None, name=None, channel=None):
        """Open a conversation."""
        return self._c._v2(
            "POST",
            "/v1/conversations",
            body={"user_ext_id": user_ext_id, "name": name, "channel": channel},
            auth="pa",
        )

    def get(self, conversation_id):
        return self._c._v2(
            "GET", "/v1/conversations/{id}".format(id=conversation_id), auth="pa"
        )

    def message(self, conversation_id, content=None):
        """Send a user message; the bot replies asynchronously."""
        return self._c._v2(
            "POST",
            "/v1/conversations/{id}/messages".format(id=conversation_id),
            body={"content": content},
            auth="pa",
        )

    def handoff(self, conversation_id):
        return self._c._v2(
            "POST",
            "/v1/conversations/{id}/handoff".format(id=conversation_id),
            body={},
            auth="pa",
        )

    def close(self, conversation_id):
        return self._c._v2(
            "POST",
            "/v1/conversations/{id}/close".format(id=conversation_id),
            body={},
            auth="pa",
        )


class EventsResource(object):
    def __init__(self, client):
        self._c = client

    def send(self, type=None, user_ext_id=None, data=None):
        """Send a business event."""
        return self._c._v2(
            "POST",
            "/v1/events",
            body={"type": type, "user_ext_id": user_ext_id, "data": data},
            auth="pa",
        )


class TasksResource(object):
    def __init__(self, client):
        self._c = client

    def schedule(self, conversation_id=None, run_at=None, text=None):
        """Schedule a follow-up."""
        return self._c._v2(
            "POST",
            "/v1/tasks",
            body={"conversation_id": conversation_id, "run_at": run_at, "text": text},
            auth="pa",
        )


# --------------------------------------------------------------------------
# multipart/form-data helper (stdlib only)
# --------------------------------------------------------------------------


def _multipart(fields=None, files=None):
    """Build a multipart/form-data body. Returns ``(content_type, body_bytes)``."""
    boundary = "----pushfy" + uuid.uuid4().hex
    crlf = b"\r\n"
    parts = []
    for name, value in (fields or {}).items():
        parts.append(b"--" + boundary.encode("ascii"))
        parts.append(
            'Content-Disposition: form-data; name="{n}"'.format(n=name).encode("utf-8")
        )
        parts.append(b"")
        parts.append(str(value).encode("utf-8"))
    for name, (filename, data, content_type) in (files or {}).items():
        parts.append(b"--" + boundary.encode("ascii"))
        parts.append(
            'Content-Disposition: form-data; name="{n}"; filename="{f}"'.format(
                n=name, f=filename
            ).encode("utf-8")
        )
        parts.append("Content-Type: {ct}".format(ct=content_type).encode("utf-8"))
        parts.append(b"")
        parts.append(data if isinstance(data, (bytes, bytearray)) else str(data).encode("utf-8"))
    parts.append(b"--" + boundary.encode("ascii") + b"--")
    parts.append(b"")
    body = crlf.join(parts)
    return "multipart/form-data; boundary={b}".format(b=boundary), body
