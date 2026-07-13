<?php

declare(strict_types=1);

namespace Pushfy\Exception;

/** 401/403 — missing/invalid token or bad HMAC signature. */
class AuthenticationException extends PushfyException
{
}
