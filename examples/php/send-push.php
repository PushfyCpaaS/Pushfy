<?php

declare(strict_types=1);

// Create and send a Push Notification campaign (server API, HMAC-signed).
//   PUSHFY_PUSH_KEY=... PUSHFY_PUSH_SECRET=... php send-push.php
//
// HMAC signing is handled by the SDK — you only supply the key/secret pair.

require __DIR__ . '/vendor/autoload.php';

use Pushfy\Pushfy;
use Pushfy\Exception\PushfyException;

$pushfy = new Pushfy([
    'pushKey'    => getenv('PUSHFY_PUSH_KEY') ?: '',
    'pushSecret' => getenv('PUSHFY_PUSH_SECRET') ?: '',
]);

try {
    // 1) Create the campaign.
    $campaign = $pushfy->push->campaigns->create([
        'name'  => 'Weekend promo',
        'title' => 'Sale!',
        'body'  => '50% off — this weekend only',
        'url'   => 'https://example.com/promo',
    ]);

    $id = $campaign['id'] ?? null;
    if ($id === null) {
        fwrite(STDERR, "No campaign id returned.\n");
        exit(1);
    }
    echo "Created campaign #{$id}\n";

    // 2) Send it.
    $pushfy->push->campaigns->send($id);
    echo "Send triggered.\n";

    // 3) Read back delivery metrics.
    $metrics = $pushfy->push->campaigns->metrics($id);
    echo "Metrics:\n";
    echo json_encode($metrics, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), "\n";
} catch (PushfyException $e) {
    fwrite(STDERR, sprintf(
        "Push campaign failed: status=%d code=%s\n",
        $e->getStatus(),
        (string) $e->getErrorCode()
    ));
    exit(1);
}
