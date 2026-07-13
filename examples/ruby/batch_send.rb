# frozen_string_literal: true

# Send a large list of SMS in bounded chunks with the Pushfy Ruby SDK.
#
#   PUSHFY_API_TOKEN=... ruby batch_send.rb
#
# Env vars:
#   PUSHFY_API_TOKEN  Messaging Bearer token (required)
#
# Splitting a big audience into fixed-size chunks keeps each request small and
# lets you pace sends. Every message carries a unique ext_id so a failed chunk
# can be replayed idempotently without double-charging the ones that succeeded.

require "pushfy"

CHUNK_SIZE = 100
PAUSE_BETWEEN_CHUNKS = 0.2 # seconds — gentle pacing to avoid rate limits

# Pretend audience — in real code, load these from your database.
def build_audience(count)
  (1..count).map do |i|
    {
      to: "5511999999999",
      text: "Hi customer #{i}, your reward is ready",
      ext_id: "campaign-42-#{i}"
    }
  end
end

def send_chunk(pushfy, chunk, index)
  pushfy.sms.send_bulk(chunk)
  puts "Chunk #{index}: sent #{chunk.size} messages"
rescue Pushfy::RateLimitError => e
  wait = e.retry_after || 5
  warn "Chunk #{index}: rate limited, waiting #{wait}s then retrying once"
  sleep(wait)
  pushfy.sms.send_bulk(chunk) # ext_ids are stable -> safe to replay
  puts "Chunk #{index}: sent #{chunk.size} messages (after backoff)"
end

def main
  pushfy = Pushfy::Client.new(api_token: ENV.fetch("PUSHFY_API_TOKEN"))

  audience = build_audience(250)
  total_chunks = (audience.size.to_f / CHUNK_SIZE).ceil

  audience.each_slice(CHUNK_SIZE).with_index(1) do |chunk, index|
    send_chunk(pushfy, chunk, index)
    sleep(PAUSE_BETWEEN_CHUNKS) if index < total_chunks
  end

  puts "Done: #{audience.size} messages across #{total_chunks} chunks."
rescue KeyError => e
  warn "Missing environment variable: #{e.message}"
  exit 1
rescue Pushfy::PushfyError => e
  warn "Batch failed: #{e.status} #{e.code} #{e.response.inspect}"
  exit 1
end

main
