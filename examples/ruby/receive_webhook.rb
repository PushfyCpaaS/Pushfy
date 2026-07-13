# frozen_string_literal: true

# Minimal WEBrick server that receives Pushfy webhooks and verifies the
# signature against the RAW request body via Pushfy::Webhooks.
#
#   PUSHFY_WEBHOOK_SECRET=... ruby receive_webhook.rb
#   # then POST to http://localhost:4567/webhooks/messaging
#
# Env vars:
#   PUSHFY_WEBHOOK_SECRET  Shared secret for the messaging webhook (required)
#   PORT                   Listen port (default 4567)
#
# Signature schemes (see Pushfy::Webhooks):
#   - messaging / push -> "sha256=<hex>"  (header X-Pushfy-Signature / X-Push-Signature)
#   - conversations    -> raw "<hex>"     (header X-PA-Signature)

require "pushfy"
require "webrick"
require "json"

def build_server
  secret = ENV.fetch("PUSHFY_WEBHOOK_SECRET")
  port = Integer(ENV.fetch("PORT", "4567"))

  server = WEBrick::HTTPServer.new(Port: port)

  server.mount_proc "/webhooks/messaging" do |req, res|
    # Verify against the exact bytes received — never a re-serialized object.
    raw_body = req.body.to_s
    signature = req["X-Pushfy-Signature"]

    ok = Pushfy::Webhooks.messaging(
      payload: raw_body,
      signature: signature,
      secret: secret
    )

    unless ok
      res.status = 401
      res.body = "invalid signature"
      next
    end

    # Respond fast (2xx), then process asynchronously in real code.
    event = begin
      JSON.parse(raw_body)
    rescue JSON::ParserError
      {}
    end
    puts "Verified webhook: #{event.inspect}"

    res.status = 200
    res.body = "ok"
  end

  trap("INT") { server.shutdown }
  server
end

if $PROGRAM_NAME == __FILE__
  begin
    server = build_server
    puts "Listening on http://localhost:#{server.config[:Port]}/webhooks/messaging"
    server.start
  rescue KeyError => e
    warn "Missing environment variable: #{e.message}"
    exit 1
  end
end
