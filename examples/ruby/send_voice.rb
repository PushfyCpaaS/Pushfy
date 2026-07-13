# frozen_string_literal: true

# Upload an audio file and place a voice call with the Pushfy Ruby SDK.
#
#   PUSHFY_API_TOKEN=... PUSHFY_AUDIO_PATH=./welcome.mp3 ruby send_voice.rb
#
# Env vars:
#   PUSHFY_API_TOKEN  Messaging Bearer token (required)
#   PUSHFY_AUDIO_PATH Path to a local .mp3 file (required)

require "pushfy"

def main
  pushfy = Pushfy::Client.new(api_token: ENV.fetch("PUSHFY_API_TOKEN"))
  audio_path = ENV.fetch("PUSHFY_AUDIO_PATH")

  upload = pushfy.voice.upload_audio(
    name: "welcome",
    data: File.binread(audio_path),
    filename: File.basename(audio_path)
  )
  audio_id = upload.is_a?(Hash) ? (upload["id"] || upload["audio_id"]) : upload
  puts "Uploaded audio: #{audio_id.inspect}"

  result = pushfy.voice.send(
    to: "5511999999999",
    audio_id: audio_id,
    ext_id: "call-#{Time.now.to_i}"
  )

  puts "Call placed: #{result.inspect}"
rescue KeyError => e
  warn "Missing environment variable: #{e.message}"
  exit 1
rescue Errno::ENOENT => e
  warn "Audio file not found: #{e.message}"
  exit 1
rescue Pushfy::RateLimitError
  warn "Rate limited — back off and retry."
  exit 1
rescue Pushfy::PushfyError => e
  warn "Failed: #{e.status} #{e.code} #{e.response.inspect}"
  exit 1
end

main
