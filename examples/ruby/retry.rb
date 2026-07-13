# frozen_string_literal: true

# Idempotent retry with exponential backoff for the Pushfy Ruby SDK.
#
#   PUSHFY_API_TOKEN=... ruby retry.rb
#
# Only transient failures are retried: Pushfy::ApiError (5xx / network / timeout)
# and Pushfy::RateLimitError (429). Authentication and invalid-request errors are
# NOT retried — retrying them never helps.
#
# The SAME ext_id is reused on every attempt so a message that actually went
# through (but whose response we never saw) is not charged twice.

require "pushfy"

# Runs `block`, retrying transient errors with exponential backoff + jitter.
def with_retry(max_attempts: 5, base_delay: 0.5, max_delay: 30.0)
  attempt = 0
  begin
    attempt += 1
    yield(attempt)
  rescue Pushfy::RateLimitError => e
    raise if attempt >= max_attempts

    delay = e.retry_after || backoff(attempt, base_delay, max_delay)
    warn "Rate limited; retrying in #{format('%.2f', delay)}s (attempt #{attempt})"
    sleep(delay)
    retry
  rescue Pushfy::ApiError => e
    raise if attempt >= max_attempts

    delay = backoff(attempt, base_delay, max_delay)
    warn "Transient error #{e.status}; retrying in #{format('%.2f', delay)}s (attempt #{attempt})"
    sleep(delay)
    retry
  end
end

# Exponential backoff with full jitter: rand(0..min(max, base * 2**(n-1))).
def backoff(attempt, base_delay, max_delay)
  capped = [max_delay, base_delay * (2**(attempt - 1))].min
  rand * capped
end

def main
  pushfy = Pushfy::Client.new(api_token: ENV.fetch("PUSHFY_API_TOKEN"))

  # Stable, deterministic ext_id — the retry key that makes resends idempotent.
  ext_id = "order-1042-confirmation"

  result = with_retry(max_attempts: 5) do |attempt|
    warn "Attempt #{attempt}..."
    pushfy.sms.send(
      to: "5511999999999",
      text: "Your order #1042 is confirmed",
      ext_id: ext_id
    )
  end

  puts "Accepted: #{result.inspect}"
rescue KeyError => e
  warn "Missing environment variable: #{e.message}"
  exit 1
rescue Pushfy::PushfyError => e
  warn "Giving up after retries: #{e.status} #{e.code} #{e.response.inspect}"
  exit 1
end

main
