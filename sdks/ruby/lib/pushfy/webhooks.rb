# frozen_string_literal: true

require "openssl"

module Pushfy
  # Verifies the authenticity of an incoming Pushfy webhook.
  #
  # Signature header differs by product:
  #   - Messaging status   -> X-Pushfy-Signature: sha256=<hex>   (scheme: :prefixed)
  #   - Push Notifications -> X-Push-Signature:   sha256=<hex>   (scheme: :prefixed)
  #   - Conversational AI  -> X-PA-Signature:      <hex>          (scheme: :raw)
  #
  # Always pass the RAW request body (the exact bytes received), not a
  # re-serialized object — re-serialization changes the signature.
  module Webhooks
    module_function

    # Returns true when the signature is valid. `scheme` is :prefixed (default)
    # or :raw (for X-PA-Signature).
    def verify(payload:, signature:, secret:, scheme: :prefixed)
      return false if signature.nil? || signature.to_s.empty?
      return false if secret.nil? || secret.to_s.empty?

      hex = OpenSSL::HMAC.hexdigest(OpenSSL::Digest.new("sha256"), secret, payload.to_s)
      expected = scheme.to_s == "raw" ? hex : "sha256=#{hex}"
      secure_compare(expected, signature.to_s)
    end

    # Convenience wrappers per product.
    def messaging(payload:, signature:, secret:)
      verify(payload: payload, signature: signature, secret: secret, scheme: :prefixed)
    end

    def push(payload:, signature:, secret:)
      verify(payload: payload, signature: signature, secret: secret, scheme: :prefixed)
    end

    def conversations(payload:, signature:, secret:)
      verify(payload: payload, signature: signature, secret: secret, scheme: :raw)
    end

    # Constant-time string comparison (manual, à la Rack::Utils.secure_compare).
    # Returns false on length mismatch without early-outing on content.
    def secure_compare(a, b)
      a = a.to_s.b
      b = b.to_s.b
      return false unless a.bytesize == b.bytesize

      result = 0
      a.bytes.each_with_index { |byte, i| result |= byte ^ b.getbyte(i) }
      result.zero?
    end
  end
end
