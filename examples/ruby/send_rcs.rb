# frozen_string_literal: true

# Send an RCS rich card with the Pushfy Ruby SDK.
#
#   PUSHFY_API_TOKEN=... ruby send_rcs.rb
#
# Env vars:
#   PUSHFY_API_TOKEN  Messaging Bearer token (required)

require "pushfy"

def main
  pushfy = Pushfy::Client.new(api_token: ENV.fetch("PUSHFY_API_TOKEN"))

  result = pushfy.rcs.send(
    to: "5511999999999",
    title: "Order shipped",
    text: "Your order #1042 is on the way",
    image: "https://cdn.example.com/box.jpg",
    url: "https://example.com/track/1042",
    cta: "Track order",
    ext_id: "rcs-1042"
  )

  puts "Accepted: #{result.inspect}"
rescue KeyError => e
  warn "Missing environment variable: #{e.message}"
  exit 1
rescue Pushfy::RateLimitError
  warn "Rate limited — back off and retry."
  exit 1
rescue Pushfy::PushfyError => e
  warn "Failed: #{e.status} #{e.code} #{e.response.inspect}"
  exit 1
end

main
