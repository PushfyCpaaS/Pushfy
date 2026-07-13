"""Official Pushfy SDK for Python.

SMS, RCS, Voice, Push Notifications and Conversational AI.

Example::

    from pushfy import Pushfy

    pushfy = Pushfy(api_token="YOUR_API_TOKEN")
    result = pushfy.sms.send(to="5511999999999", text="Hello from Pushfy")
"""

from .client import Pushfy
from . import webhooks
from .errors import (
    PushfyError,
    AuthenticationError,
    InvalidRequestError,
    RateLimitError,
    ApiError,
    error_from_response,
)

__version__ = "1.0.0"

__all__ = [
    "Pushfy",
    "webhooks",
    "PushfyError",
    "AuthenticationError",
    "InvalidRequestError",
    "RateLimitError",
    "ApiError",
    "error_from_response",
]
