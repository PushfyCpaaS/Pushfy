# frozen_string_literal: true

require "openssl"

module Pushfy
  # Builds the canonical string and HMAC-SHA256 signature used by the Pushfy V2
  # API (Push server + Conversational AI). Must match the server exactly:
  #
  #   base      = timestamp + "\n" + METHOD + "\n" + path + "\n" + sha256hex(body)
  #   signature = hex( HMAC-SHA256(base, secret) )
  #
  # `path` is the route only (e.g. "/v1/conversations"), without the query string.
  module Hmac
    module_function

    # Returns { timestamp: "<unix>", signature: "<hex>" }.
    def sign(method:, path:, secret:, body: "", timestamp: nil)
      ts = (timestamp || Time.now.to_i).to_s
      body_hash = OpenSSL::Digest::SHA256.hexdigest(body.to_s)
      base = "#{ts}\n#{method.to_s.upcase}\n#{path}\n#{body_hash}"
      signature = OpenSSL::HMAC.hexdigest(OpenSSL::Digest.new("sha256"), secret, base)
      { timestamp: ts, signature: signature }
    end
  end
end
