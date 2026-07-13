package com.pushfy;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/**
 * Verifies the authenticity of an incoming Pushfy webhook.
 *
 * <p>The signature header differs by product:
 * <ul>
 *   <li>Messaging status  &rarr; {@code X-Pushfy-Signature: sha256=<hex>}  (scheme {@code "prefixed"})</li>
 *   <li>Push Notifications &rarr; {@code X-Push-Signature:   sha256=<hex>}  (scheme {@code "prefixed"})</li>
 *   <li>Conversational AI  &rarr; {@code X-PA-Signature:      <hex>}         (scheme {@code "raw"})</li>
 * </ul>
 *
 * <p>Always pass the RAW request body (the exact bytes received), not a
 * re-serialized object — re-serialization changes the signature.
 *
 * <p>Comparison uses {@link MessageDigest#isEqual(byte[], byte[])}, which is
 * constant-time on modern JDKs, so verification is not vulnerable to timing
 * attacks.
 */
public final class Webhooks {

    public static final String SCHEME_PREFIXED = "prefixed";
    public static final String SCHEME_RAW = "raw";

    private Webhooks() {
    }

    /** Verify a string payload (encoded as UTF-8). */
    public static boolean verify(String payload, String signature, String secret, String scheme) {
        byte[] body = payload == null ? new byte[0] : payload.getBytes(StandardCharsets.UTF_8);
        return verify(body, signature, secret, scheme);
    }

    /**
     * Verify a raw-bytes payload.
     *
     * @param payload   raw request body bytes.
     * @param signature value of the signature header.
     * @param secret    your webhook secret.
     * @param scheme    {@link #SCHEME_RAW} for X-PA-Signature, else {@link #SCHEME_PREFIXED}.
     * @return true when the signature is valid.
     */
    public static boolean verify(byte[] payload, String signature, String secret, String scheme) {
        if (signature == null || secret == null) {
            return false;
        }
        byte[] body = payload == null ? new byte[0] : payload;
        String hex = Hmac.hmacSha256HexBytes(body, secret);
        String expected = SCHEME_RAW.equals(scheme) ? hex : "sha256=" + hex;
        byte[] a = expected.getBytes(StandardCharsets.UTF_8);
        byte[] b = signature.getBytes(StandardCharsets.UTF_8);
        return MessageDigest.isEqual(a, b);
    }

    /** Messaging status/DLR webhooks: {@code X-Pushfy-Signature: sha256=<hex>}. */
    public static boolean messaging(String payload, String signature, String secret) {
        return verify(payload, signature, secret, SCHEME_PREFIXED);
    }

    public static boolean messaging(byte[] payload, String signature, String secret) {
        return verify(payload, signature, secret, SCHEME_PREFIXED);
    }

    /** Push Notifications webhooks: {@code X-Push-Signature: sha256=<hex>}. */
    public static boolean push(String payload, String signature, String secret) {
        return verify(payload, signature, secret, SCHEME_PREFIXED);
    }

    public static boolean push(byte[] payload, String signature, String secret) {
        return verify(payload, signature, secret, SCHEME_PREFIXED);
    }

    /** Conversational AI (PushAgent) webhooks: {@code X-PA-Signature: <hex>} (raw). */
    public static boolean conversations(String payload, String signature, String secret) {
        return verify(payload, signature, secret, SCHEME_RAW);
    }

    public static boolean conversations(byte[] payload, String signature, String secret) {
        return verify(payload, signature, secret, SCHEME_RAW);
    }
}
