# Pushfy SDK for PHP

Official PHP client for the [Pushfy API](https://github.com/PushfyCpaaS/Pushfy) —
SMS, RCS, Voice, Push Notifications and Conversational AI.

- Requires **PHP 7.4+** with `ext-curl` and `ext-json`.
- Zero external dependencies (uses cURL directly).

## Installation

```bash
composer require pushfy/pushfy
```

```php
require __DIR__ . '/vendor/autoload.php';
```

## Quick start

```php
use Pushfy\Pushfy;

$pushfy = new Pushfy(['apiToken' => 'YOUR_API_TOKEN']);

$result = $pushfy->sms->send([
    'to'    => '5511999999999',
    'text'  => 'Hello from Pushfy',
    'extId' => 'welcome-001',
]);

print_r($result); // [ ['id' => ..., 'phone' => ..., 'date' => ..., 'ext_id' => ...] ]
```

## Authentication

Different products use different credentials — pass whatever you need:

```php
$pushfy = new Pushfy([
    'apiToken'   => 'YOUR_API_TOKEN',   // Messaging (SMS/RCS/Voice, status, balance)
    'paKey'      => 'pak_...',          // Conversational AI (HMAC)
    'paSecret'   => 'pas_...',
    'pushKey'    => 'pushk_...',        // Push server API (HMAC)
    'pushSecret' => 'pss_...',
    'appId'      => 'pushapp_...',      // Public Push app id
    'timeout'    => 30000,              // request timeout in ms (default 30000)
]);
```

HMAC signing for the V2 (Push / Conversational) endpoints is handled automatically.

## Usage

### SMS

```php
$pushfy->sms->send(['to' => '5511999999999', 'text' => 'Hi', 'extId' => 'ref-1']);

$pushfy->sms->sendBulk([
    ['to' => '5511999990001', 'text' => 'Hi Ana',   'extId' => 'b1'],
    ['to' => '5511999990002', 'text' => 'Hi Bruno', 'extId' => 'b2'],
]);
```

### RCS

```php
$pushfy->rcs->send([
    'to'    => '5511999999999',
    'title' => 'Order shipped',
    'text'  => 'Your order #1042 is on the way',
    'image' => 'https://cdn.example.com/box.jpg',
    'url'   => 'https://example.com/track/1042',
    'cta'   => 'Track order',
]);
```

### Voice

```php
$upload = $pushfy->voice->uploadAudio([
    'name' => 'welcome',
    'data' => file_get_contents('./welcome.mp3'), // raw mp3 bytes
]);
$pushfy->voice->send(['to' => '5511999999999', 'audioId' => 'AUDIO_ID', 'extId' => 'call-1']);
```

### Delivery status & balance

```php
$pushfy->messages->status(['extId' => 'ref-1']);
$pushfy->messages->byDate('2026-07-01');
$pushfy->messages->report(['start' => '2026-07-01 00:00:00', 'end' => '2026-07-01 23:59:59']);

$balance = $pushfy->balance->get(); // ['raw' => '1.500', 'balance' => 1500]
```

### Push Notifications (server)

```php
$c = $pushfy->push->campaigns->create([
    'name' => 'Promo', 'title' => 'Sale!', 'body' => '50% off', 'url' => 'https://example.com',
]);
$pushfy->push->campaigns->send($c['id']);
$pushfy->push->campaigns->metrics($c['id']);

// Public (browser/app) endpoints inject your app_id automatically:
$pushfy->push->subscribe(['token' => 'DEVICE_TOKEN']);
$pushfy->push->track(['event' => 'opened', 'campaign_id' => 42]);
```

### Conversational AI

```php
$conv = $pushfy->conversations->open(['userExtId' => 'user-42', 'name' => 'Ana']);
$pushfy->conversations->message($conv['conversation_id'], ['content' => 'I need help with a withdrawal']);
$state = $pushfy->conversations->get($conv['conversation_id']); // bot replies asynchronously

$pushfy->events->send(['type' => 'deposit.completed', 'userExtId' => 'user-42', 'data' => ['amount' => 100]]);
$pushfy->tasks->schedule(['conversationId' => $conv['conversation_id'], 'runAt' => '2026-07-14 09:00:00', 'text' => 'Follow up']);
```

## Error handling

Every failure throws a typed exception you can branch on. All extend
`Pushfy\Exception\PushfyException`.

```php
use Pushfy\Exception\AuthenticationException;
use Pushfy\Exception\RateLimitException;
use Pushfy\Exception\InvalidRequestException;
use Pushfy\Exception\ApiException;

try {
    $pushfy->sms->send(['to' => '5511999999999', 'text' => 'Hi']);
} catch (RateLimitException $e) {
    // back off and retry; $e->getRetryAfter() when available
} catch (AuthenticationException $e) {
    // check your token / HMAC keys
} catch (InvalidRequestException $e) {
    // 4xx — fix the request
} catch (ApiException $e) {
    // 5xx / network — safe to retry idempotently (reuse the same extId)
    error_log($e->getStatus() . ' ' . (string) $e->getErrorCode());
}
```

> **Never blindly resend after a send timeout** — you may double-charge. Query the
> status by `extId` first.

## Verifying webhooks

Always verify against the **raw** request body (the exact bytes received). The
signature header and scheme differ per product:

| Product            | Header               | Scheme          | Helper                          |
| ------------------ | -------------------- | --------------- | ------------------------------- |
| Messaging status   | `X-Pushfy-Signature` | `sha256=<hex>`  | `Webhooks::messaging(...)`      |
| Push Notifications | `X-Push-Signature`   | `sha256=<hex>`  | `Webhooks::push(...)`           |
| Conversational AI  | `X-PA-Signature`     | raw `<hex>`     | `Webhooks::conversations(...)`  |

```php
use Pushfy\Webhooks;

$payload   = file_get_contents('php://input'); // RAW body — do not re-serialize
$signature = $_SERVER['HTTP_X_PUSHFY_SIGNATURE'] ?? null;

$ok = Webhooks::messaging($payload, $signature, getenv('WEBHOOK_SECRET'));
if (!$ok) {
    http_response_code(401);
    exit;
}
http_response_code(200); // respond fast, process async
```

Verification is constant-time (`hash_equals`).

## Tests

```bash
php tests/smoke.php   # offline: HMAC, webhooks, request shaping, balance parsing
```

## License

MIT © Pushfy
