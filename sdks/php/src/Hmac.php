<?php

declare(strict_types=1);

namespace Pushfy;

/**
 * Builds the canonical string and HMAC-SHA256 signature used by the Pushfy V2
 * API (Push server + Conversational AI). Must match the server exactly:
 *
 *   base      = timestamp + "\n" + METHOD + "\n" + path + "\n" + sha256hex(body)
 *   signature = hex( HMAC-SHA256(base, secret) )
 *
 * `path` is the route only (e.g. "/v1/conversations"), without the query string.
 */
final class Hmac
{
    /**
     * @param string      $method
     * @param string      $path
     * @param string      $body
     * @param string      $secret
     * @param int|null    $timestamp  Unix seconds; defaults to now.
     * @return array{timestamp: string, signature: string}
     */
    public static function sign(string $method, string $path, string $body, string $secret, ?int $timestamp = null): array
    {
        $ts = (string) ($timestamp ?? time());
        $bodyHash = hash('sha256', $body);
        $base = $ts . "\n" . strtoupper($method) . "\n" . $path . "\n" . $bodyHash;
        $signature = hash_hmac('sha256', $base, $secret);

        return ['timestamp' => $ts, 'signature' => $signature];
    }
}
