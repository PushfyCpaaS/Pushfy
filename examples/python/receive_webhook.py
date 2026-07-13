"""Minimal webhook receiver that validates the Pushfy signature.

Run:  WEBHOOK_SECRET=... python3 receive_webhook.py
      # then POST to http://localhost:8000/webhook

Handles all three signature families:
  - Messaging status : header X-Pushfy-Signature, format "sha256=<hex>"
  - Push             : header X-Push-Signature,   format "sha256=<hex>"
  - Conversations    : header X-PA-Signature,     format "<hex>" (raw)

The pushfy.webhooks helpers verify against the RAW body in constant time — so
we must never parse and re-serialize the JSON before verifying.

This uses only the standard library (http.server) so it runs anywhere. In
production terminate TLS in front of it (Pushfy requires public HTTPS) and move
the dedupe set into Redis/DB.
"""

import json
import os
from http.server import BaseHTTPRequestHandler, HTTPServer

from pushfy import webhooks

WEBHOOK_SECRET = os.environ["WEBHOOK_SECRET"]

# Dedupe store — swap for Redis/DB in production. Push/Conversations events
# carry a unique `eid`; messaging status is an array of receipts (dedupe those
# by the per-row `ext_id`).
_seen = set()


def verify(raw_body, headers):
    """Return True if the signature matches, picking the variant by header."""
    if "X-Pushfy-Signature" in headers:
        return webhooks.messaging(
            payload=raw_body,
            signature=headers["X-Pushfy-Signature"],
            secret=WEBHOOK_SECRET,
        )
    if "X-Push-Signature" in headers:
        return webhooks.push(
            payload=raw_body,
            signature=headers["X-Push-Signature"],
            secret=WEBHOOK_SECRET,
        )
    if "X-PA-Signature" in headers:
        return webhooks.conversations(
            payload=raw_body,
            signature=headers["X-PA-Signature"],
            secret=WEBHOOK_SECRET,
        )
    return False


class WebhookHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path != "/webhook":
            self.send_response(404)
            self.end_headers()
            return

        length = int(self.headers.get("Content-Length", 0))
        raw_body = self.rfile.read(length)  # exact bytes — sign these

        if not verify(raw_body, self.headers):
            self.send_response(401)
            self.end_headers()
            return

        payload = json.loads(raw_body.decode("utf-8"))

        # Dedupe by eid (Push/Conversations). Redeliveries are expected.
        eid = (
            self.headers.get("X-Push-Delivery")
            or self.headers.get("X-PA-Delivery")
            or (payload.get("eid") if isinstance(payload, dict) else None)
        )
        if eid:
            if eid in _seen:
                self.send_response(200)  # already handled
                self.end_headers()
                return
            _seen.add(eid)

        # Acknowledge FAST, then process asynchronously off the request path.
        self.send_response(200)
        self.end_headers()
        process_event(payload)

    def log_message(self, *args):
        pass  # quiet default logging


def process_event(payload):
    # Real work goes here (enqueue to a worker, update a DB, ...).
    print("Verified webhook:", payload)


def main():
    port = int(os.environ.get("PORT", "8000"))
    server = HTTPServer(("0.0.0.0", port), WebhookHandler)
    print("Listening on http://0.0.0.0:%d/webhook" % port)
    server.serve_forever()


if __name__ == "__main__":
    main()
