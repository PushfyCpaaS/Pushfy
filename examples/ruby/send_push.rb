# frozen_string_literal: true

# Create and send a Push Notification campaign with the Pushfy Ruby SDK.
#
#   PUSHFY_PUSH_KEY=... PUSHFY_PUSH_SECRET=... ruby send_push.rb
#
# Env vars:
#   PUSHFY_PUSH_KEY     Push server HMAC key (pushk_...)   (required)
#   PUSHFY_PUSH_SECRET  Push server HMAC secret (pss_...)  (required)
#
# HMAC signing of the V2 endpoints is handled by the SDK.

require "pushfy"

def main
  pushfy = Pushfy::Client.new(
    push_key: ENV.fetch("PUSHFY_PUSH_KEY"),
    push_secret: ENV.fetch("PUSHFY_PUSH_SECRET")
  )

  campaign = pushfy.push.campaigns.create(
    name: "Weekend Promo",
    title: "Sale is live!",
    body: "50% off everything this weekend",
    url: "https://example.com/sale"
  )
  campaign_id = campaign["id"]
  puts "Created campaign #{campaign_id}"

  pushfy.push.campaigns.send(campaign_id)
  puts "Campaign #{campaign_id} sent"

  metrics = pushfy.push.campaigns.metrics(campaign_id)
  puts "Metrics: #{metrics.inspect}"
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
