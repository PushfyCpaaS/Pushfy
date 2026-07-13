# frozen_string_literal: true

# Rescue the typed errors raised by the Pushfy Ruby SDK.
#
#   PUSHFY_API_TOKEN=... ruby error_handling.rb
#
# Every failure raises a subclass of Pushfy::PushfyError, each exposing
# #status (HTTP status, 0 for network/timeout), #code (API error string)
# and #response (parsed body).

require "pushfy"

def main
  pushfy = Pushfy::Client.new(api_token: ENV.fetch("PUSHFY_API_TOKEN"))

  pushfy.sms.send(to: "5511999999999", text: "Hello from Pushfy")
  puts "Sent."
rescue KeyError => e
  warn "Missing environment variable: #{e.message}"
  exit 1
rescue Pushfy::AuthenticationError => e
  # 401/403 — token missing/invalid or bad HMAC signature. Do NOT retry.
  warn "Authentication failed (#{e.status}): check your API token."
  exit 1
rescue Pushfy::InvalidRequestError => e
  # 4xx — malformed request. Fix the payload; retrying won't help.
  warn "Invalid request (#{e.status} #{e.code}): #{e.response.inspect}"
  exit 1
rescue Pushfy::RateLimitError => e
  # 429 — slow down. retry_after is seconds when the API provides it.
  wait = e.retry_after || 5
  warn "Rate limited — retry after #{wait}s."
  exit 1
rescue Pushfy::ApiError => e
  # 5xx / network / timeout — safe to retry idempotently (reuse the ext_id).
  warn "Transient API error (#{e.status}): #{e.message}"
  exit 1
rescue Pushfy::PushfyError => e
  # Catch-all for anything new the SDK might add.
  warn "Unexpected Pushfy error: #{e.status} #{e.code} #{e.response.inspect}"
  exit 1
end

main
