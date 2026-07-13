"""Send several SMS in a single request with send_bulk.

Run:  PUSHFY_API_TOKEN=... python3 send_bulk_sms.py

For very large lists (tens of thousands of recipients) split into chunks —
see batch_send.py.
"""

import os

from pushfy import Pushfy


def main():
    pushfy = Pushfy(api_token=os.environ["PUSHFY_API_TOKEN"])

    # Each message carries its own unique ext_id so you can correlate the
    # per-recipient delivery status later.
    messages = [
        {"to": "5511999990001", "text": "Hi Ana",   "ext_id": "promo-0001"},
        {"to": "5511999990002", "text": "Hi Bruno", "ext_id": "promo-0002"},
        {"to": "5511999990003", "text": "Hi Carla", "ext_id": "promo-0003"},
    ]

    result = pushfy.sms.send_bulk(messages)
    print("Accepted %d messages:" % len(messages))
    print(result)


if __name__ == "__main__":
    main()
