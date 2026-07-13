<?php

declare(strict_types=1);

// Send an SMS with the Pushfy PHP SDK.
//   php examples/send_sms.php
// Requires PUSHFY_API_TOKEN in your environment.
//
// With Composer: require __DIR__ . '/../vendor/autoload.php';
require __DIR__ . '/../vendor/autoload.php';

use Pushfy\Pushfy;
use Pushfy\Exception\RateLimitException;
use Pushfy\Exception\PushfyException;

$pushfy = new Pushfy([
    'apiToken' => getenv('PUSHFY_API_TOKEN') ?: 'YOUR_API_TOKEN',
]);

try {
    $result = $pushfy->sms->send([
        'to' => '5511999999999',
        'text' => 'Hello from the Pushfy PHP SDK',
        'extId' => 'demo-' . time(),
    ]);
    echo "Accepted:\n";
    echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), "\n";
} catch (RateLimitException $e) {
    fwrite(STDERR, "Rate limited — back off and retry.\n");
    exit(1);
} catch (PushfyException $e) {
    fwrite(STDERR, sprintf(
        "Failed: status=%d code=%s\n",
        $e->getStatus(),
        (string) $e->getErrorCode()
    ));
    exit(1);
}
