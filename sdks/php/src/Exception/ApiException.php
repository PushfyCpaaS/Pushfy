<?php

declare(strict_types=1);

namespace Pushfy\Exception;

/** 5xx / network / timeout — safe to retry (idempotently). */
class ApiException extends PushfyException
{
}
