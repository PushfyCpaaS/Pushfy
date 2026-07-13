# frozen_string_literal: true

# Send many SMS in a single request with the Pushfy Ruby SDK.
#
#   PUSHFY_API_TOKEN=... ruby send_bulk_sms.rb
#
# Env vars:
#   PUSHFY_API_TOKEN  Messaging Bearer token (required)
#
# Each message carries its own ext_id so you can reconcile delivery status
# per recipient later via pushfy.messages.status(ext_id: ...).

require "pushfy"

def main
  pushfy = Pushfy::Client.new(api_token: ENV.fetch("PUSHFY_API_TOKEN"))

  recipients = [
    { to: "5511999999999", text: "Hi Ana, your code is 4821",   ext_id: "bulk-ana" },
    { to: "5511999999999", text: "Hi Bruno, your code is 7719", ext_id: "bulk-bruno" },
    { to: "5511999999999", text: "Hi Carla, your code is 3355", ext_id: "bulk-carla" }
  ]

  result = pushfy.sms.send_bulk(recipients)

  puts "Accepted #{recipients.size} messages: #{result.inspect}"
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
