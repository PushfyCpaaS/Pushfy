"""Send an SMS with the Pushfy Python SDK.

    python examples/send_sms.py

Requires PUSHFY_API_TOKEN in your environment.
"""

import os
import sys
import time

from pushfy import Pushfy, RateLimitError


def main():
    pushfy = Pushfy(api_token=os.environ.get("PUSHFY_API_TOKEN"))

    try:
        result = pushfy.sms.send(
            to="5511999999999",
            text="Hello from the Pushfy Python SDK",
            ext_id="demo-{ts}".format(ts=int(time.time())),
        )
        print("Accepted:", result)
    except RateLimitError:
        print("Rate limited — back off and retry.", file=sys.stderr)
        sys.exit(1)
    except Exception as err:  # pushfy.PushfyError subclasses
        print(
            "Failed:", getattr(err, "status", None), getattr(err, "code", None),
            getattr(err, "response", None), file=sys.stderr,
        )
        sys.exit(1)


if __name__ == "__main__":
    main()
