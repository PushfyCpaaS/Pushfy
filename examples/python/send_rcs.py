"""Send a rich RCS message (title, image and a call-to-action button).

Run:  PUSHFY_API_TOKEN=... python3 send_rcs.py

Credentials come from the environment — never hardcode secrets.
"""

import os

from pushfy import Pushfy


def main():
    pushfy = Pushfy(api_token=os.environ["PUSHFY_API_TOKEN"])

    result = pushfy.rcs.send(
        to="5511999999999",
        title="Order shipped",
        text="Your order #1042 is on the way",
        image="https://cdn.example.com/box.jpg",
        url="https://example.com/track/1042",
        cta="Track order",
        ext_id="order-1042-shipped",
    )

    print("Accepted:", result)


if __name__ == "__main__":
    main()
