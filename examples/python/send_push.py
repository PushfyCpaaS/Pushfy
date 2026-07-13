"""Create, send and measure a Push Notification campaign (server API).

Run:  PUSHFY_PUSH_KEY=pushk_... PUSHFY_PUSH_SECRET=pss_... python3 send_push.py

The Push server API is signed with HMAC — the SDK handles the signing once you
pass push_key / push_secret.
"""

import os

from pushfy import Pushfy


def main():
    pushfy = Pushfy(
        push_key=os.environ["PUSHFY_PUSH_KEY"],
        push_secret=os.environ["PUSHFY_PUSH_SECRET"],
    )

    campaign = pushfy.push.campaigns.create(
        {
            "name": "Promo",
            "title": "Sale!",
            "body": "50% off today only",
            "url": "https://example.com/sale",
        }
    )
    campaign_id = campaign["id"]
    print("Created campaign:", campaign_id)

    pushfy.push.campaigns.send(campaign_id)
    print("Campaign sent.")

    metrics = pushfy.push.campaigns.metrics(campaign_id)
    print("Metrics:", metrics)


if __name__ == "__main__":
    main()
