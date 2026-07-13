package com.pushfy;

/** 5xx / network / timeout — safe to retry (idempotently, reusing the same extId). */
public class ApiException extends PushfyException {

    private static final long serialVersionUID = 1L;

    public ApiException(String message, int status, String code, Object response) {
        super(message, status, code, response);
    }
}
