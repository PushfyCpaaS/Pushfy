<?php

declare(strict_types=1);

// Offline smoke test — validates HMAC signing, webhook verification, request
// shaping and response parsing without hitting the network.
//   php tests/smoke.php
// Prints "OK" and exits 0 on success; prints the failure and exits 1 otherwise.

// Minimal PSR-4 autoloader so this runs without `composer install`.
spl_autoload_register(static function (string $class): void {
    $prefix = 'Pushfy\\';
    if (strpos($class, $prefix) !== 0) {
        return;
    }
    $rel = str_replace('\\', '/', substr($class, strlen($prefix)));
    $file = __DIR__ . '/../src/' . $rel . '.php';
    if (is_file($file)) {
        require $file;
    }
});

use Pushfy\Pushfy;
use Pushfy\Hmac;
use Pushfy\Webhooks;
use Pushfy\Exception\AuthenticationException;

$passed = 0;
function check(bool $cond, string $name): void
{
    global $passed;
    if (!$cond) {
        fwrite(STDERR, "FAILED: {$name}\n");
        exit(1);
    }
    echo "  ok  {$name}\n";
    $passed++;
}

// Records the last request and returns a canned response.
function mockTransport(array $response): array
{
    $calls = [];
    $fn = function (string $url, string $method, array $headers, ?string $body) use (&$calls, $response): array {
        $calls[] = compact('url', 'method', 'headers', 'body');
        $text = is_string($response['body'] ?? null)
            ? $response['body']
            : json_encode($response['body'] ?? null);
        return ['status' => $response['status'] ?? 200, 'body' => $text];
    };
    return [$fn, function () use (&$calls) { return $calls; }];
}

// 1. HMAC signing matches the documented recipe exactly.
{
    $ts = 1752345600;
    $body = '{"user_ext_id":"user-42"}';
    $secret = 'pas_test';
    $sig = Hmac::sign('post', '/v1/conversations', $body, $secret, $ts);
    $bh = hash('sha256', $body);
    $base = "{$ts}\nPOST\n/v1/conversations\n{$bh}";
    $expected = hash_hmac('sha256', $base, $secret);
    check($sig['signature'] === $expected, 'HMAC signature matches canonical base string');
    check($sig['timestamp'] === (string) $ts, 'HMAC timestamp echoed as string');
}

// 2. sms->send hits /webapi with Bearer auth and normalized phone digits.
{
    [$fn, $calls] = mockTransport(['body' => [['id' => 'x', 'phone' => '5511999999999', 'date' => '2026-07-12 10:00:00', 'ext_id' => 'x']]]);
    $pushfy = new Pushfy(['apiToken' => 'YOUR_API_TOKEN', 'transport' => $fn]);
    $res = $pushfy->sms->send(['to' => '+55 (11) 99999-9999', 'text' => 'Hi', 'extId' => 'x']);
    $call = $calls()[0];
    check(substr($call['url'], -strlen('/webapi')) === '/webapi', 'URL is /webapi');
    check($call['method'] === 'POST', 'method is POST');
    check(($call['headers']['Authorization'] ?? '') === 'Bearer YOUR_API_TOKEN', 'Bearer token header set');
    $sent = json_decode($call['body'], true);
    check($sent['messages'][0]['destinations'][0]['to'] === '5511999999999', 'phone digits normalized');
    check($sent['messages'][0]['text'] === 'Hi', 'text passed through');
    check($sent['messages'][0]['ext_id'] === 'x', 'ext_id mapped');
    check($res[0]['ext_id'] === 'x', 'array response returned');
}

// 3. balance->get parses the formatted string {"saldo":"1.500"} -> 1500.
{
    [$fn] = mockTransport(['body' => ['saldo' => '1.500']]);
    $pushfy = new Pushfy(['apiToken' => 't', 'transport' => $fn]);
    $b = $pushfy->balance->get();
    check($b === ['raw' => '1.500', 'balance' => 1500], 'balance parses {"saldo":"1.500"} -> 1500');
}

// 4. conversations->open signs with X-PA-* headers and routes via ?r=.
{
    [$fn, $calls] = mockTransport(['body' => ['ok' => true, 'conversation_id' => 1, 'status' => 'bot']]);
    $pushfy = new Pushfy(['paKey' => 'pak_x', 'paSecret' => 'pas_x', 'transport' => $fn]);
    $pushfy->conversations->open(['userExtId' => 'user-42', 'name' => 'Ana']);
    $call = $calls()[0];
    check(strpos($call['url'], 'r=%2Fv1%2Fconversations') !== false, 'route sent via ?r=');
    check(($call['headers']['X-PA-Key'] ?? '') === 'pak_x', 'X-PA-Key header set');
    check(!empty($call['headers']['X-PA-Signature']) && !empty($call['headers']['X-PA-Timestamp']), 'signature + timestamp set');
    // Body is the exact bytes that were signed.
    $sig = Hmac::sign('POST', '/v1/conversations', $call['body'], 'pas_x', (int) $call['headers']['X-PA-Timestamp']);
    check($sig['signature'] === $call['headers']['X-PA-Signature'], 'X-PA-Signature signs the sent body');
}

// 5. push->campaigns->send uses X-PUSH-* headers and empty object body "{}".
{
    [$fn, $calls] = mockTransport(['body' => ['ok' => true]]);
    $pushfy = new Pushfy(['pushKey' => 'pushk_x', 'pushSecret' => 'pss_x', 'transport' => $fn]);
    $pushfy->push->campaigns->send(88);
    $call = $calls()[0];
    check(strpos($call['url'], 'r=%2Fv1%2Fpush%2Fcampaigns%2F88%2Fsend') !== false, 'push campaign route encoded');
    check(($call['headers']['X-PUSH-Key'] ?? '') === 'pushk_x', 'X-PUSH-Key header set');
    check($call['body'] === '{}', 'empty body serializes to {} not []');
}

// 6. webhook verification: raw (X-PA) vs prefixed (X-Push/X-Pushfy) schemes.
{
    $secret = 'WEBHOOK_SECRET';
    $payload = '{"eid":"evt_1","event":"handoff.requested"}';
    $hex = hash_hmac('sha256', $payload, $secret);
    check(Webhooks::conversations($payload, $hex, $secret) === true, 'raw scheme accepts bare hex (X-PA)');
    check(Webhooks::push($payload, 'sha256=' . $hex, $secret) === true, 'prefixed scheme accepts sha256= (X-Push)');
    check(Webhooks::push($payload, $hex, $secret) === false, 'prefixed scheme rejects bare hex');
    check(Webhooks::conversations($payload, 'deadbeef', $secret) === false, 'raw scheme rejects bad signature');
    check(Webhooks::messaging($payload, null, $secret) === false, 'missing signature rejected');
}

// 7. errors: 401 -> AuthenticationException.
{
    [$fn] = mockTransport(['status' => 401, 'body' => ['ok' => false, 'error' => 'unauthorized']]);
    $pushfy = new Pushfy(['apiToken' => 'bad', 'transport' => $fn]);
    $caught = null;
    try {
        $pushfy->sms->send(['to' => '5511999999999', 'text' => 'x']);
    } catch (AuthenticationException $e) {
        $caught = $e;
    }
    check($caught !== null && $caught->getStatus() === 401 && $caught->getErrorCode() === 'unauthorized', '401 throws AuthenticationException');
}

echo "\n{$passed} checks passed.\n";
echo "OK\n";
exit(0);
