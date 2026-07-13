<?php

declare(strict_types=1);

// Send a single SMS.
//   PUSHFY_API_TOKEN=... php send-sms.php
//
// Credentials come from the environment — never hard-code secrets.

require __DIR__ . '/vendor/autoload.php';

use Pushfy\Pushfy;
use Pushfy\Exception\RateLimitException;
use Pushfy\Exception\PushfyException;

$pushfy = new Pushfy([
    'apiToken' => getenv('PUSHFY_API_TOKEN') ?: '',
]);

try {
    // extId is YOUR idempotency key: reuse it to query status or retry safely.
    $result = $pushfy->sms->send([
        'to'    => '5511999999999',
        'text'  => 'Hello from the Pushfy PHP SDK',
        'extId' => 'welcome-' . time(),
    ]);

    echo "Accepted:\n";
    echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), "\n";
} catch (RateLimitException $e) {
    $wait = $e->getRetryAfter() ?? 5;
    fwrite(STDERR, "Rate limited — retry after {$wait}s.\n");
    exit(1);
} catch (PushfyException $e) {
    fwrite(STDERR, sprintf(
        "Send failed: status=%d code=%s\n",
        $e->getStatus(),
        (string) $e->getErrorCode()
    ));
    exit(1);
}
