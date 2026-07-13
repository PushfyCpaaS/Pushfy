package com.pushfy;

/** 400/413/415 — the request was malformed. */
public class InvalidRequestException extends PushfyException {

    private static final long serialVersionUID = 1L;

    public InvalidRequestException(String message, int status, String code, Object response) {
        super(message, status, code, response);
    }
}
