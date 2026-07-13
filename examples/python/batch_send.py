"""Send a large recipient list by splitting it into chunks.

Run:  PUSHFY_API_TOKEN=... python3 batch_send.py

A single request accepts up to 100,000 messages, but smaller chunks keep each
request well under the payload limit, give steadier throughput, and make retries
cheaper. Every message keeps its own unique ext_id so failures can be retried
per-chunk without duplicating the successful ones.
"""

import os

from pushfy import Pushfy, ApiError, RateLimitError

CHUNK_SIZE = 1000


def chunked(items, size):
    for i in range(0, len(items), size):
        yield items[i:i + size]


def build_messages():
    # Stand-in recipient list. Replace with your real audience.
    base = 5511999990000
    return [
        {
            "to": str(base + i),
            "text": "Hello from Pushfy",
            "ext_id": "batch-%06d" % i,
        }
        for i in range(2500)
    ]


def main():
    pushfy = Pushfy(api_token=os.environ["PUSHFY_API_TOKEN"])
    messages = build_messages()

    accepted = 0
    failed_chunks = []

    for index, chunk in enumerate(chunked(messages, CHUNK_SIZE)):
        try:
            pushfy.sms.send_bulk(chunk)
            accepted += len(chunk)
            print("Chunk %d ok (%d messages)" % (index, len(chunk)))
        except (RateLimitError, ApiError) as err:
            # Record the chunk; retry it later (see retry.py) — the stable
            # ext_ids make a re-send safe.
            print("Chunk %d failed: %s" % (index, type(err).__name__))
            failed_chunks.append(index)

    print("Done. Accepted %d/%d messages, %d chunk(s) to retry."
          % (accepted, len(messages), len(failed_chunks)))


if __name__ == "__main__":
    main()
