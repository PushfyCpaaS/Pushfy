"""Idempotent retry with exponential backoff and jitter.

Run:  PUSHFY_API_TOKEN=... python3 retry.py

Retry only transient failures (5xx / network via ApiError, and 429 via
RateLimitError). Reuse the SAME ext_id on every attempt so a retry can never
create a duplicate message or a double charge. Never retry AuthenticationError
or InvalidRequestError — those won't succeed on a repeat.

WARNING: a send that times out may have SUCCEEDED server-side. For strict
safety, look up the status by ext_id before resending. Because we hold ext_id
fixed here, the platform can dedupe a genuine repeat.
"""

import os
import random
import time

from pushfy import (
    Pushfy,
    ApiError,
    AuthenticationError,
    InvalidRequestError,
    RateLimitError,
)

MAX_ATTEMPTS = 5
BASE_DELAY = 1.0   # seconds
MAX_DELAY = 30.0   # cap the backoff


def backoff_delay(attempt):
    """Exponential backoff (1s, 2s, 4s, 8s...) with full jitter."""
    capped = min(MAX_DELAY, BASE_DELAY * (2 ** attempt))
    return random.uniform(0, capped)


def send_with_retry(pushfy, **kwargs):
    last_error = None
    for attempt in range(MAX_ATTEMPTS):
        try:
            return pushfy.sms.send(**kwargs)

        except (AuthenticationError, InvalidRequestError):
            # Permanent — retrying won't help. Re-raise immediately.
            raise

        except (RateLimitError, ApiError) as err:
            # Transient — back off and try again with the same ext_id.
            last_error = err
            if attempt == MAX_ATTEMPTS - 1:
                break
            delay = backoff_delay(attempt)
            print("Attempt %d failed (%s); retrying in %.2fs"
                  % (attempt + 1, type(err).__name__, delay))
            time.sleep(delay)

    raise last_error


def main():
    pushfy = Pushfy(api_token=os.environ["PUSHFY_API_TOKEN"])

    result = send_with_retry(
        pushfy,
        to="5511999999999",
        text="Hello from Pushfy",
        ext_id="welcome-001",   # stable across every retry
    )
    print("Accepted:", result)


if __name__ == "__main__":
    main()
