<?php

declare(strict_types=1);

// Send a large recipient list by splitting it into fixed-size chunks.
//   PUSHFY_API_TOKEN=... php batch-send.php
//
// Each chunk is one sendBulk() request. Chunking keeps requests small,
// bounds memory, and lets you pace calls to stay under rate limits. A
// per-recipient extId makes any single chunk safe to retry.

require __DIR__ . '/vendor/autoload.php';

use Pushfy\Pushfy;
use Pushfy\Exception\RateLimitException;
use Pushfy\Exception\PushfyException;

$pushfy = new Pushfy([
    'apiToken' => getenv('PUSHFY_API_TOKEN') ?: '',
]);

// Build a demo audience. In production this comes from your DB / CSV.
$audience = [];
for ($i = 1; $i <= 250; $i++) {
    $audience[] = [
        'to'    => '5511999999999',
        'text'  => "Message #{$i} from the batch demo",
        'extId' => sprintf('batch-2026-07-13-%04d', $i), // stable, unique
    ];
}

$chunkSize = 100;
$chunks = array_chunk($audience, $chunkSize);
$sent = 0;
$failedChunks = [];

foreach ($chunks as $index => $chunk) {
    $label = sprintf('chunk %d/%d (%d msgs)', $index + 1, count($chunks), count($chunk));
    try {
        $pushfy->sms->sendBulk($chunk);
        $sent += count($chunk);
        echo "OK {$label}\n";
    } catch (RateLimitException $e) {
        $wait = $e->getRetryAfter() ?? 5;
        fwrite(STDERR, "Rate limited on {$label}; sleeping {$wait}s then retrying once.\n");
        sleep((int) $wait);
        try {
            $pushfy->sms->sendBulk($chunk); // extIds make this safe
            $sent += count($chunk);
            echo "OK (retry) {$label}\n";
        } catch (PushfyException $e2) {
            $failedChunks[] = $index + 1;
            fwrite(STDERR, "FAILED {$label}: {$e2->getMessage()}\n");
        }
    } catch (PushfyException $e) {
        $failedChunks[] = $index + 1;
        fwrite(STDERR, "FAILED {$label}: {$e->getMessage()}\n");
    }

    // Gentle pacing between chunks to be a good API citizen.
    usleep(200_000); // 200ms
}

echo "\nDone. Sent {$sent} messages across ", count($chunks), " chunks.\n";
if ($failedChunks) {
    echo "Failed chunks: ", implode(', ', $failedChunks), " (safe to re-run — extIds are idempotent).\n";
    exit(1);
}
