package com.pushfy;

/** 401/403 — missing/invalid token or bad HMAC signature. */
public class AuthenticationException extends PushfyException {

    private static final long serialVersionUID = 1L;

    public AuthenticationException(String message, int status, String code, Object response) {
        super(message, status, code, response);
    }
}
