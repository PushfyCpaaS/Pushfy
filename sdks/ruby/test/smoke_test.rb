# frozen_string_literal: true

# Offline smoke test — validates request shaping, HMAC signing and webhook
# verification without hitting the network. Run: ruby test/smoke_test.rb
require "openssl"
require "json"
require_relative "../lib/pushfy"

$passed = 0
def ok(name)
  puts "  ✓ #{name}"
  $passed += 1
end

def assert(cond, msg = "assertion failed")
  raise msg unless cond
end

# Records the last request and returns a canned response. Compatible with the
# Client's injectable transport: #call(url, method:, headers:, body:) -> Hash.
class MockHttp
  attr_reader :calls

  def initialize(status: 200, body: "")
    @status = status
    @body = body.is_a?(String) ? body : JSON.generate(body)
    @calls = []
  end

  def call(url, method:, headers:, body:)
    @calls << { url: url, method: method, headers: headers, body: body }
    { status: @status, body: @body }
  end
end

begin
  # 1. HMAC signing matches the documented recipe exactly.
  ts = 1_752_345_600
  body = '{"user_ext_id":"user-42"}'
  secret = "pas_test"
  sig = Pushfy::Hmac.sign(method: "post", path: "/v1/conversations", body: body, secret: secret, timestamp: ts)
  bh = OpenSSL::Digest::SHA256.hexdigest(body)
  base = "#{ts}\nPOST\n/v1/conversations\n#{bh}"
  expected = OpenSSL::HMAC.hexdigest(OpenSSL::Digest.new("sha256"), secret, base)
  assert(sig[:signature] == expected, "HMAC signature mismatch")
  assert(sig[:timestamp] == ts.to_s, "timestamp mismatch")
  ok("HMAC signature matches canonical base string (ts\\nMETHOD\\nroute\\nsha256hex(body))")

  # 2. sms.send hits /webapi with Bearer auth and normalized digits.
  http = MockHttp.new(body: [{ "id" => "x", "phone" => "5511999999999", "ext_id" => "x" }])
  pushfy = Pushfy::Client.new(api_token: "YOUR_API_TOKEN", http: http)
  res = pushfy.sms.send(to: "+55 (11) 99999-9999", text: "Hi", ext_id: "x")
  call = http.calls[0]
  assert(call[:url].end_with?("/webapi"), "URL is /webapi")
  assert(call[:method] == "POST", "method POST")
  assert(call[:headers]["Authorization"] == "Bearer YOUR_API_TOKEN", "Bearer header")
  sent = JSON.parse(call[:body])
  assert(sent["messages"][0]["destinations"][0]["to"] == "5511999999999", "phone digits normalized")
  assert(sent["messages"][0]["text"] == "Hi", "text sent")
  assert(res[0]["ext_id"] == "x", "array response parsed")
  ok("sms.send shapes /webapi request and parses the array response")

  # 3. balance.get parses the formatted string "1.500" -> 1500.
  http = MockHttp.new(body: { "saldo" => "1.500" })
  pushfy = Pushfy::Client.new(api_token: "t", http: http)
  b = pushfy.balance.get
  assert(b == { raw: "1.500", balance: 1500 }, "balance parse: #{b.inspect}")
  ok('balance.get parses {"saldo":"1.500"} -> 1500')

  # 4. conversations.open signs with X-PA-* headers and routes via ?r=.
  http = MockHttp.new(body: { "ok" => true, "conversation_id" => 1, "status" => "bot" })
  pushfy = Pushfy::Client.new(pa_key: "pak_x", pa_secret: "pas_x", http: http)
  pushfy.conversations.open(user_ext_id: "user-42", name: "Ana")
  call = http.calls[0]
  assert(call[:url].include?("r=%2Fv1%2Fconversations"), "route sent via ?r=")
  assert(call[:headers]["X-PA-Key"] == "pak_x", "X-PA-Key header set")
  assert(call[:headers]["X-PA-Signature"] && call[:headers]["X-PA-Timestamp"], "signature + timestamp set")
  ok("conversations.open signs request with X-PA-* headers")

  # 5. push server call uses X-PUSH-* headers.
  http = MockHttp.new(body: { "ok" => true })
  pushfy = Pushfy::Client.new(push_key: "pushk_x", push_secret: "pss_x", http: http)
  pushfy.push.campaigns.send(88)
  call = http.calls[0]
  assert(call[:url].include?("r=%2Fv1%2Fpush%2Fcampaigns%2F88%2Fsend"), "push route encoded")
  assert(call[:headers]["X-PUSH-Key"] == "pushk_x", "X-PUSH-Key header set")
  ok("push.campaigns.send signs with X-PUSH-* headers")

  # 6. webhook verification: raw vs prefixed schemes.
  secret = "WEBHOOK_SECRET"
  payload = '{"eid":"evt_1","event":"handoff.requested"}'
  hex = OpenSSL::HMAC.hexdigest(OpenSSL::Digest.new("sha256"), secret, payload)
  assert(Pushfy::Webhooks.conversations(payload: payload, signature: hex, secret: secret) == true,
         "raw (X-PA) accepts bare hex")
  assert(Pushfy::Webhooks.push(payload: payload, signature: "sha256=#{hex}", secret: secret) == true,
         "prefixed accepts sha256= hex")
  assert(Pushfy::Webhooks.push(payload: payload, signature: hex, secret: secret) == false,
         "push requires sha256= prefix")
  assert(Pushfy::Webhooks.conversations(payload: payload, signature: "deadbeef", secret: secret) == false,
         "bad signature rejected")
  assert(Pushfy::Webhooks.messaging(payload: payload, signature: nil, secret: secret) == false,
         "nil signature rejected")
  ok("webhook verify handles raw (X-PA) and prefixed (X-Push/X-Pushfy) schemes")

  # 7. errors: 401 -> AuthenticationError.
  http = MockHttp.new(status: 401, body: { "ok" => false, "error" => "unauthorized" })
  pushfy = Pushfy::Client.new(api_token: "bad", http: http)
  caught = nil
  begin
    pushfy.sms.send(to: "5511999999999", text: "x")
  rescue Pushfy::PushfyError => e
    caught = e
  end
  assert(caught.is_a?(Pushfy::AuthenticationError), "AuthenticationError class")
  assert(caught.status == 401, "status 401")
  assert(caught.code == "unauthorized", "code parsed")
  ok("401 response raises AuthenticationError")

  # 8. errors: 429 -> RateLimitError.
  http = MockHttp.new(status: 429, body: { "error" => "rate_limited" })
  pushfy = Pushfy::Client.new(api_token: "t", http: http)
  caught = nil
  begin
    pushfy.sms.send(to: "5511999999999", text: "x")
  rescue Pushfy::PushfyError => e
    caught = e
  end
  assert(caught.is_a?(Pushfy::RateLimitError), "RateLimitError class")
  ok("429 response raises RateLimitError")

  puts "\n#{$passed} checks passed."
rescue StandardError => e
  warn "\nSMOKE TEST FAILED: #{e.message}"
  warn e.backtrace.first(5).join("\n")
  exit 1
end
