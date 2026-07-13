<?php

declare(strict_types=1);

// Idempotent retry with exponential backoff + jitter.
//   PUSHFY_API_TOKEN=... php retry.php
//
// Golden rule: reuse a STABLE extId across attempts and, before resending
// after a timeout, ask the API whether the message already went out — this
// prevents double-charging. We only retry transient failures (5xx / network
// / rate limit); 4xx and auth errors are fatal and re-thrown immediately.

require __DIR__ . '/vendor/autoload.php';

use Pushfy\Pushfy;
use Pushfy\Exception\RateLimitException;
use Pushfy\Exception\ApiException;
use Pushfy\Exception\PushfyException;

$pushfy = new Pushfy([
    'apiToken' => getenv('PUSHFY_API_TOKEN') ?: '',
]);

/**
 * Send one SMS with bounded, idempotent retries.
 *
 * @param array{to: string, text: string, extId: string} $params
 * @return mixed
 * @throws PushfyException when retries are exhausted or the error is fatal.
 */
function sendWithRetry(Pushfy $pushfy, array $params, int $maxAttempts = 5)
{
    $extId = $params['extId']; // STABLE across every attempt.

    for ($attempt = 1; $attempt <= $maxAttempts; $attempt++) {
        try {
            // Before a resend, check if a previous attempt already succeeded.
            if ($attempt > 1) {
                $status = $pushfy->messages->status(['extId' => $extId]);
                if (!empty($status)) {
                    fwrite(STDERR, "extId {$extId} already accepted — not resending.\n");
                    return $status;
                }
            }

            return $pushfy->sms->send($params);
        } catch (RateLimitException $e) {
            $delay = $e->getRetryAfter() ?? backoffSeconds($attempt);
            rethrowIfLast($e, $attempt, $maxAttempts);
            fwrite(STDERR, "Rate limited, waiting {$delay}s (attempt {$attempt}).\n");
            sleep((int) $delay);
        } catch (ApiException $e) {
            // 5xx / network / timeout — transient.
            $delay = backoffSeconds($attempt);
            rethrowIfLast($e, $attempt, $maxAttempts);
            fwrite(STDERR, "Transient error (status {$e->getStatus()}), waiting {$delay}s (attempt {$attempt}).\n");
            sleep((int) $delay);
        }
        // Any other PushfyException (auth/4xx) is fatal — let it propagate.
    }

    throw new ApiException('Retries exhausted for extId ' . $extId, 0);
}

/** Exponential backoff with full jitter: base 0.5s, capped at 30s. */
function backoffSeconds(int $attempt): float
{
    $cap = 30.0;
    $base = 0.5 * (2 ** ($attempt - 1));
    $window = min($cap, $base);
    return mt_rand(0, (int) ($window * 1000)) / 1000; // full jitter
}

function rethrowIfLast(PushfyException $e, int $attempt, int $maxAttempts): void
{
    if ($attempt >= $maxAttempts) {
        throw $e;
    }
}

try {
    $result = sendWithRetry($pushfy, [
        'to'    => '5511999999999',
        'text'  => 'Reliable delivery via idempotent retry',
        'extId' => 'retry-demo-fixed-key', // reuse the same key on rerun
    ]);
    echo "Delivered/accepted:\n";
    echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), "\n";
} catch (PushfyException $e) {
    fwrite(STDERR, sprintf(
        "Gave up: status=%d code=%s\n",
        $e->getStatus(),
        (string) $e->getErrorCode()
    ));
    exit(1);
}
