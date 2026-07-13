# frozen_string_literal: true

# Send an SMS with the Pushfy Ruby SDK.
#   ruby examples/send_sms.rb
# Requires PUSHFY_API_TOKEN in your environment.

require_relative "../lib/pushfy"

def main
  pushfy = Pushfy::Client.new(api_token: ENV["PUSHFY_API_TOKEN"])

  result = pushfy.sms.send(
    to: "5511999999999",
    text: "Hello from the Pushfy Ruby SDK",
    ext_id: "demo-#{Time.now.to_i}"
  )
  puts "Accepted: #{result.inspect}"
rescue Pushfy::RateLimitError
  warn "Rate limited — back off and retry."
  exit 1
rescue Pushfy::PushfyError => e
  warn "Failed: #{e.status} #{e.code} #{e.response.inspect}"
  exit 1
end

main
