<?php

declare(strict_types=1);

// Send many SMS in a single API request (one call, many recipients).
//   PUSHFY_API_TOKEN=... php send-bulk-sms.php
//
// Use sendBulk() when you already have the full list in memory. For very
// large lists that must be split into fixed-size requests, see batch-send.php.

require __DIR__ . '/vendor/autoload.php';

use Pushfy\Pushfy;
use Pushfy\Exception\PushfyException;

$pushfy = new Pushfy([
    'apiToken' => getenv('PUSHFY_API_TOKEN') ?: '',
]);

// Each recipient carries its own unique extId (your idempotency key).
$messages = [
    ['to' => '5511999999999', 'text' => 'Hi Ana, your code is 1234',   'extId' => 'otp-ana-001'],
    ['to' => '5511999999999', 'text' => 'Hi Bruno, your code is 5678', 'extId' => 'otp-bruno-002'],
    ['to' => '5511999999999', 'text' => 'Hi Célia, your code is 9012', 'extId' => 'otp-celia-003'],
];

try {
    $result = $pushfy->sms->sendBulk($messages);

    echo "Accepted ", count($messages), " messages:\n";
    echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), "\n";
} catch (PushfyException $e) {
    fwrite(STDERR, sprintf(
        "Bulk send failed: status=%d code=%s\n",
        $e->getStatus(),
        (string) $e->getErrorCode()
    ));
    exit(1);
}
