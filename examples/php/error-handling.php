<?php

declare(strict_types=1);

// Typed error handling: branch on the specific exception subclass.
//   PUSHFY_API_TOKEN=... php error-handling.php
//
// Every failure throws a subclass of Pushfy\Exception\PushfyException, so a
// single catch can be a safety net while the specific ones drive behaviour.

require __DIR__ . '/vendor/autoload.php';

use Pushfy\Pushfy;
use Pushfy\Exception\AuthenticationException;
use Pushfy\Exception\RateLimitException;
use Pushfy\Exception\InvalidRequestException;
use Pushfy\Exception\ApiException;
use Pushfy\Exception\PushfyException;

$pushfy = new Pushfy([
    'apiToken' => getenv('PUSHFY_API_TOKEN') ?: '',
]);

try {
    $result = $pushfy->sms->send([
        'to'    => '5511999999999',
        'text'  => 'Testing typed error handling',
        'extId' => 'err-demo-' . time(),
    ]);
    echo "Accepted:\n";
    echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), "\n";
} catch (RateLimitException $e) {
    // 429 — respect the server's backoff hint when present.
    $wait = $e->getRetryAfter() ?? 5;
    fwrite(STDERR, "Rate limited. Back off {$wait}s and retry.\n");
    exit(1);
} catch (AuthenticationException $e) {
    // 401/403 — bad or missing token/HMAC keys. Not retryable.
    fwrite(STDERR, "Auth failed (status {$e->getStatus()}). Check PUSHFY_API_TOKEN.\n");
    exit(1);
} catch (InvalidRequestException $e) {
    // 4xx — the request is wrong (bad phone, missing field). Fix and resend.
    fwrite(STDERR, sprintf(
        "Invalid request: status=%d code=%s\n",
        $e->getStatus(),
        (string) $e->getErrorCode()
    ));
    exit(1);
} catch (ApiException $e) {
    // 5xx / network / timeout — transient. Safe to retry with the SAME extId.
    fwrite(STDERR, sprintf(
        "Server/network error: status=%d code=%s — retry idempotently.\n",
        $e->getStatus(),
        (string) $e->getErrorCode()
    ));
    exit(1);
} catch (PushfyException $e) {
    // Catch-all safety net for anything not handled above.
    fwrite(STDERR, "Unexpected Pushfy error: {$e->getMessage()}\n");
    exit(1);
}
