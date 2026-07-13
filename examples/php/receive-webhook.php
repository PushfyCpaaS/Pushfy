<?php

declare(strict_types=1);

// Webhook receiver: verify the signature against the RAW body, then process.
//
// Point your Pushfy messaging-status webhook at this endpoint and set
// PUSHFY_WEBHOOK_SECRET in the environment. Respond fast (200) and defer
// heavy work to a queue.
//
// The signature header and scheme differ per product:
//   Messaging status   -> X-Pushfy-Signature: sha256=<hex>  Webhooks::messaging()
//   Push Notifications  -> X-Push-Signature:   sha256=<hex>  Webhooks::push()
//   Conversational AI   -> X-PA-Signature:      <hex>         Webhooks::conversations()

require __DIR__ . '/vendor/autoload.php';

use Pushfy\Webhooks;

$secret = getenv('PUSHFY_WEBHOOK_SECRET') ?: '';

// 1) Read the RAW body exactly as received — never re-serialize before verifying.
$payload = file_get_contents('php://input');
if ($payload === false) {
    $payload = '';
}

// 2) Grab the signature header (messaging status webhook).
$signature = $_SERVER['HTTP_X_PUSHFY_SIGNATURE'] ?? null;

// 3) Constant-time verification (hash_equals under the hood).
if (!Webhooks::messaging($payload, $signature, $secret)) {
    http_response_code(401);
    echo 'invalid signature';
    exit;
}

// 4) Signature is valid — parse and handle. Keep this fast; queue real work.
$event = json_decode($payload, true);
if (!is_array($event)) {
    http_response_code(400);
    echo 'bad json';
    exit;
}

// Example: log the delivery status by your ext_id.
error_log(sprintf(
    '[pushfy webhook] ext_id=%s status=%s',
    (string) ($event['ext_id'] ?? ''),
    (string) ($event['status'] ?? $event['event'] ?? '')
));

// 5) Acknowledge quickly so Pushfy does not retry.
http_response_code(200);
echo 'ok';
