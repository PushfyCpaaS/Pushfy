"""Branch on the typed errors the SDK raises.

Run:  PUSHFY_API_TOKEN=... python3 error_handling.py

Every failure raises a typed error you can catch. Order matters: catch the
specific subclasses before the ApiError base class.
"""

import os

from pushfy import (
    Pushfy,
    ApiError,
    AuthenticationError,
    InvalidRequestError,
    RateLimitError,
)


def main():
    pushfy = Pushfy(api_token=os.environ["PUSHFY_API_TOKEN"])

    try:
        result = pushfy.sms.send(
            to="5511999999999",
            text="Hello from Pushfy",
            ext_id="welcome-001",
        )
        print("Accepted:", result)

    except RateLimitError:
        # 429 — back off and retry later (see retry.py). Never tight-loop.
        print("Rate limited — back off and retry.")

    except AuthenticationError:
        # 401 — bad/missing token. Retrying won't help; fix the credentials.
        print("Authentication failed — check PUSHFY_API_TOKEN.")

    except InvalidRequestError as err:
        # 4xx — a bad parameter (invalid number, empty body, ...). Do not retry
        # as-is; fix the request first.
        print("Invalid request:", err.status, err.code, err.response)

    except ApiError as err:
        # 5xx / network / timeout — safe to retry idempotently by reusing the
        # SAME ext_id so a repeat can't create a duplicate charge.
        print("Server/network error:", err.status, err.code, err.response)


if __name__ == "__main__":
    main()
