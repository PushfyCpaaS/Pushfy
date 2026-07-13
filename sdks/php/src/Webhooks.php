<?php

declare(strict_types=1);

namespace Pushfy;

/**
 * Verifies the authenticity of an incoming Pushfy webhook.
 *
 * Signature header differs by product:
 *   - Messaging status   -> X-Pushfy-Signature: sha256=<hex>   (scheme: 'prefixed')
 *   - Push Notifications  -> X-Push-Signature:   sha256=<hex>   (scheme: 'prefixed')
 *   - Conversational AI   -> X-PA-Signature:      <hex>          (scheme: 'raw')
 *
 * Always pass the RAW request body (the exact bytes received), not a
 * re-serialized array — re-serialization changes the signature.
 */
final class Webhooks
{
    public const SCHEME_PREFIXED = 'prefixed';
    public const SCHEME_RAW = 'raw';

    /**
     * @param string $payload    Raw request body (exact bytes).
     * @param string $signature  Value of the signature header.
     * @param string $secret     Your webhook secret.
     * @param string $scheme     'prefixed' (sha256=<hex>) or 'raw' (<hex>).
     * @return bool  true when the signature is valid.
     */
    public static function verify(string $payload, ?string $signature, string $secret, string $scheme = self::SCHEME_PREFIXED): bool
    {
        if ($signature === null || $signature === '' || $secret === '') {
            return false;
        }

        $hex = hash_hmac('sha256', $payload, $secret);
        $expected = $scheme === self::SCHEME_RAW ? $hex : 'sha256=' . $hex;

        // hash_equals is constant-time and length-safe.
        return hash_equals($expected, $signature);
    }

    /** Messaging status/DLR webhook: X-Pushfy-Signature (sha256=<hex>). */
    public static function messaging(string $payload, ?string $signature, string $secret): bool
    {
        return self::verify($payload, $signature, $secret, self::SCHEME_PREFIXED);
    }

    /** Push Notifications webhook: X-Push-Signature (sha256=<hex>). */
    public static function push(string $payload, ?string $signature, string $secret): bool
    {
        return self::verify($payload, $signature, $secret, self::SCHEME_PREFIXED);
    }

    /** Conversational AI (PushAgent) webhook: X-PA-Signature (raw hex). */
    public static function conversations(string $payload, ?string $signature, string $secret): bool
    {
        return self::verify($payload, $signature, $secret, self::SCHEME_RAW);
    }
}
