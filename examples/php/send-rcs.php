<?php

declare(strict_types=1);

// Send an RCS rich card (title, image, tracked URL and a call-to-action).
//   PUSHFY_API_TOKEN=... php send-rcs.php

require __DIR__ . '/vendor/autoload.php';

use Pushfy\Pushfy;
use Pushfy\Exception\PushfyException;

$pushfy = new Pushfy([
    'apiToken' => getenv('PUSHFY_API_TOKEN') ?: '',
]);

try {
    $result = $pushfy->rcs->send([
        'to'    => '5511999999999',
        'title' => 'Order shipped',
        'text'  => 'Your order #1042 is on the way.',
        'image' => 'https://cdn.example.com/box.jpg',
        'url'   => 'https://example.com/track/1042',
        'cta'   => 'Track order',
        'extId' => 'rcs-order-1042',
    ]);

    echo "Accepted:\n";
    echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), "\n";
} catch (PushfyException $e) {
    fwrite(STDERR, sprintf(
        "RCS send failed: status=%d code=%s\n",
        $e->getStatus(),
        (string) $e->getErrorCode()
    ));
    exit(1);
}
