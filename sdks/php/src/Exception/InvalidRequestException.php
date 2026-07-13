<?php

declare(strict_types=1);

namespace Pushfy\Exception;

/** 400/413/415 — the request was malformed. */
class InvalidRequestException extends PushfyException
{
}
