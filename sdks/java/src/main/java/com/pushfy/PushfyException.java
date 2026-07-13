package com.pushfy;

import java.util.Map;

/**
 * Base error for every failure surfaced by the SDK.
 *
 * <p>{@code status} is the HTTP status (0 for network/timeout), {@code code} is
 * the API error string (e.g. {@code "unauthorized"}, {@code "rate_limited"}),
 * and {@code response} is the parsed body (a {@link Map}, {@link java.util.List}
 * or scalar) when available.
 *
 * <p>All SDK exceptions are unchecked so call sites stay clean.
 */
public class PushfyException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    public final int status;
    public final String code;
    public final transient Object response;

    public PushfyException(String message, int status, String code, Object response) {
        super(message);
        this.status = status;
        this.code = code;
        this.response = response;
    }

    public PushfyException(String message) {
        this(message, 0, null, null);
    }

    /** Maps an HTTP status + parsed body to the right error subclass. */
    public static PushfyException fromResponse(int status, Object body) {
        String code = null;
        if (body instanceof Map) {
            Map<?, ?> m = (Map<?, ?>) body;
            Object c = m.get("error");
            if (c == null) {
                c = m.get("code");
            }
            if (c != null) {
                code = String.valueOf(c);
            }
        }
        String msg = code != null
                ? "Pushfy API error: " + code
                : "Pushfy API error (HTTP " + status + ")";

        if (status == 401 || status == 403) {
            return new AuthenticationException(msg, status, code, body);
        }
        if (status == 429) {
            return new RateLimitException("Rate limited", status, code, body, null);
        }
        if (status >= 400 && status < 500) {
            return new InvalidRequestException(msg, status, code, body);
        }
        return new ApiException(msg, status, code, body);
    }
}
