package com.pushfy;

/** 429 — rate limited. {@code retryAfter} is seconds, when known (may be null). */
public class RateLimitException extends PushfyException {

    private static final long serialVersionUID = 1L;

    public final Integer retryAfter;

    public RateLimitException(String message, int status, String code, Object response, Integer retryAfter) {
        super(message, status, code, response);
        this.retryAfter = retryAfter;
    }
}
