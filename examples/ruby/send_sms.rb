# frozen_string_literal: true

# Send a single SMS with the Pushfy Ruby SDK.
#
#   PUSHFY_API_TOKEN=... ruby send_sms.rb
#
# Env vars:
#   PUSHFY_API_TOKEN  Messaging Bearer token (required)

require "pushfy"

def main
  pushfy = Pushfy::Client.new(api_token: ENV.fetch("PUSHFY_API_TOKEN"))

  result = pushfy.sms.send(
    to: "5511999999999",
    text: "Hello from the Pushfy Ruby SDK",
    ext_id: "sms-#{Time.now.to_i}"
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
