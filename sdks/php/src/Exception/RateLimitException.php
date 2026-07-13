<?php

declare(strict_types=1);

namespace Pushfy\Exception;

/** 429 — rate limited. `retryAfter` is seconds, when known. */
class RateLimitException extends PushfyException
{
    /** @var int|null */
    private $retryAfter;

    /**
     * @param mixed $response
     */
    public function __construct(string $message, int $status = 429, ?string $code = null, $response = null, ?int $retryAfter = null)
    {
        parent::__construct($message, $status, $code, $response);
        $this->retryAfter = $retryAfter;
    }

    /** Seconds to wait before retrying, when the API provides it. */
    public function getRetryAfter(): ?int
    {
        return $this->retryAfter;
    }
}
