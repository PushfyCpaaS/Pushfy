<?php

declare(strict_types=1);

namespace Pushfy\Exception;

/**
 * Base exception for every failure surfaced by the SDK.
 *
 * `status`   is the HTTP status (0 for network/timeout),
 * `code`     is the API error string (e.g. "unauthorized", "rate_limited"),
 * `response` is the parsed response body (array) when available.
 */
class PushfyException extends \Exception
{
    /** @var int */
    protected $status;

    /** @var string|null */
    protected $errorCode;

    /** @var mixed */
    protected $response;

    /**
     * @param string     $message
     * @param int        $status
     * @param string|null $code
     * @param mixed      $response
     */
    public function __construct(string $message, int $status = 0, ?string $code = null, $response = null)
    {
        parent::__construct($message);
        $this->status = $status;
        $this->errorCode = $code;
        $this->response = $response;
    }

    /** HTTP status code (0 for network/timeout errors). */
    public function getStatus(): int
    {
        return $this->status;
    }

    /** API error string (e.g. "unauthorized"), or null. */
    public function getErrorCode(): ?string
    {
        return $this->errorCode;
    }

    /** Parsed response body, or null. */
    public function getResponse()
    {
        return $this->response;
    }

    /**
     * Maps an HTTP status + parsed body to the right exception class.
     *
     * @param int   $status
     * @param mixed $body
     */
    public static function fromResponse(int $status, $body): PushfyException
    {
        $code = null;
        if (is_array($body)) {
            if (isset($body['error'])) {
                $code = (string) $body['error'];
            } elseif (isset($body['code'])) {
                $code = (string) $body['code'];
            }
        }

        $message = $code !== null
            ? 'Pushfy API error: ' . $code
            : 'Pushfy API error (HTTP ' . $status . ')';

        if ($status === 401 || $status === 403) {
            return new AuthenticationException($message, $status, $code, $body);
        }
        if ($status === 429) {
            $retryAfter = null;
            if (is_array($body) && isset($body['retry_after'])) {
                $retryAfter = (int) $body['retry_after'];
            }
            return new RateLimitException('Rate limited', $status, $code, $body, $retryAfter);
        }
        if ($status >= 400 && $status < 500) {
            return new InvalidRequestException($message, $status, $code, $body);
        }

        return new ApiException($message, $status, $code, $body);
    }
}
