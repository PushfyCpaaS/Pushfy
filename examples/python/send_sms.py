"""Send a single SMS.

Run:  PUSHFY_API_TOKEN=... python3 send_sms.py

Credentials come from the environment — never hardcode secrets.
"""

import os

from pushfy import Pushfy


def main():
    pushfy = Pushfy(api_token=os.environ["PUSHFY_API_TOKEN"])

    # `ext_id` is YOUR reference for this message. Keep it stable and unique so
    # you can later query the delivery status and dedupe safely on retries.
    result = pushfy.sms.send(
        to="5511999999999",          # E.164 digits, no leading "+"
        text="Hello from Pushfy",
        ext_id="welcome-001",
    )

    # The API returns a list: [{"id": ..., "phone": ..., "date": ..., "ext_id": ...}]
    print("Accepted:", result)


if __name__ == "__main__":
    main()
