package com.pushfy;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/**
 * Builds the canonical string and HMAC-SHA256 signature used by the Pushfy V2
 * API (Push server + Conversational AI). Must match the server exactly:
 *
 * <pre>
 *   base      = timestamp + "\n" + METHOD + "\n" + path + "\n" + sha256hex(body)
 *   signature = hex( HMAC-SHA256(base, secret) )
 * </pre>
 *
 * {@code path} is the route only (e.g. {@code "/v1/conversations"}), without the
 * query string.
 */
public final class Hmac {

    private Hmac() {
    }

    /** Result of {@link #sign}: the timestamp used and the hex signature. */
    public static final class Signed {
        public final String timestamp;
        public final String signature;

        Signed(String timestamp, String signature) {
            this.timestamp = timestamp;
            this.signature = signature;
        }
    }

    /** Sign using the current unix time (seconds). */
    public static Signed sign(String method, String path, String body, String secret) {
        return sign(method, path, body, secret, null);
    }

    /**
     * Sign the canonical base string.
     *
     * @param method    HTTP method (case-insensitive).
     * @param path      route only, e.g. {@code /v1/conversations}.
     * @param body      raw request body (may be empty).
     * @param secret    signing secret (pas_... or pss_...).
     * @param timestamp explicit unix seconds, or {@code null} for "now".
     */
    public static Signed sign(String method, String path, String body, String secret, Long timestamp) {
        String ts = String.valueOf(timestamp != null ? timestamp : (System.currentTimeMillis() / 1000L));
        String bodyHash = sha256Hex(body == null ? "" : body);
        String base = ts + "\n" + method.toUpperCase() + "\n" + path + "\n" + bodyHash;
        String signature = hmacSha256Hex(base, secret);
        return new Signed(ts, signature);
    }

    /** Lowercase hex SHA-256 of a UTF-8 string. */
    public static String sha256Hex(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return hex(md.digest(input.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    /** Lowercase hex HMAC-SHA256 of a UTF-8 string. */
    public static String hmacSha256Hex(String data, String secret) {
        return hmacSha256HexBytes(data.getBytes(StandardCharsets.UTF_8), secret);
    }

    /** Lowercase hex HMAC-SHA256 of raw bytes (used for webhook bodies). */
    public static String hmacSha256HexBytes(byte[] data, String secret) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return hex(mac.doFinal(data));
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    static String hex(byte[] bytes) {
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) {
            sb.append(Character.forDigit((b >> 4) & 0xF, 16));
            sb.append(Character.forDigit(b & 0xF, 16));
        }
        return sb.toString();
    }
}
