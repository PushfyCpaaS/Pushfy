# frozen_string_literal: true

# Upload an audio file under a name and place a voice call with the Pushfy Ruby SDK.
# The upload does NOT return an audio id — the audio is identified by the name
# you choose. Use that same name when placing the call.
#
#   PUSHFY_API_TOKEN=... PUSHFY_AUDIO_PATH=./welcome.mp3 ruby send_voice.rb
#
# Env vars:
#   PUSHFY_API_TOKEN  Messaging Bearer token (required)
#   PUSHFY_AUDIO_PATH Path to a local .mp3 file (required)
#   PUSHFY_AUDIO_NAME Name that identifies the audio (default "Welcome message")

require "pushfy"

def main
  pushfy = Pushfy::Client.new(api_token: ENV.fetch("PUSHFY_API_TOKEN"))
  audio_path = ENV.fetch("PUSHFY_AUDIO_PATH")
  # The name identifies the audio on both steps. Keep upload and call in sync.
  audio_name = ENV.fetch("PUSHFY_AUDIO_NAME", "Welcome message")

  pushfy.voice.upload_audio(
    name: audio_name,
    data: File.binread(audio_path),
    filename: File.basename(audio_path)
  )
  puts "Uploaded audio: #{audio_name.inspect}"

  result = pushfy.voice.send(
    to: "5511999999999",
    audio_name: audio_name,
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
