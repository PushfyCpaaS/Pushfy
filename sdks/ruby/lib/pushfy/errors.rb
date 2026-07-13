# frozen_string_literal: true

module Pushfy
  # Base error for every failure surfaced by the SDK.
  # `status` is the HTTP status (0 for network/timeout), `code` is the API error
  # string (e.g. "unauthorized", "rate_limited"), `response` is the parsed body.
  class PushfyError < StandardError
    attr_reader :status, :code, :response

    def initialize(message, status: 0, code: nil, response: nil)
      super(message)
      @status = status
      @code = code
      @response = response
    end
  end

  # 401/403 — missing/invalid token or bad HMAC signature.
  class AuthenticationError < PushfyError; end

  # 400/413/415 — the request was malformed.
  class InvalidRequestError < PushfyError; end

  # 429 — rate limited. `retry_after` is seconds, when known.
  class RateLimitError < PushfyError
    attr_reader :retry_after

    def initialize(message, retry_after: nil, **meta)
      super(message, **meta)
      @retry_after = retry_after
    end
  end

  # 5xx / network / timeout — safe to retry (idempotently).
  class ApiError < PushfyError; end

  # Maps an HTTP status + parsed body to the right error class.
  def self.error_from_response(status, body)
    code = if body.is_a?(Hash) && (body["error"] || body["code"])
             (body["error"] || body["code"]).to_s
           end
    msg = code ? "Pushfy API error: #{code}" : "Pushfy API error (HTTP #{status})"
    meta = { status: status, code: code, response: body }

    case status
    when 401, 403 then AuthenticationError.new(msg, **meta)
    when 429      then RateLimitError.new("Rate limited", **meta)
    else
      if status >= 400 && status < 500
        InvalidRequestError.new(msg, **meta)
      else
        ApiError.new(msg, **meta)
      end
    end
  end
end
