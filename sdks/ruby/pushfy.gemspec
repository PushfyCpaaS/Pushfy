# frozen_string_literal: true

require_relative "lib/pushfy/version"

Gem::Specification.new do |spec|
  spec.name        = "pushfy"
  spec.version     = Pushfy::VERSION
  spec.summary     = "Official Pushfy SDK for Ruby — SMS, RCS, Voice, Push Notifications and Conversational AI."
  spec.description = "Official Ruby client for the Pushfy API (CPaaS): send SMS, RCS and Voice, " \
                     "query delivery status and balance, manage Push Notifications, and drive " \
                     "Conversational AI. HMAC signing and webhook verification built in. Zero " \
                     "runtime dependencies (stdlib only)."
  spec.authors     = ["Pushfy"]
  spec.email       = ["dev@pushfy.com"]
  spec.homepage    = "https://github.com/PushfyCpaaS/Pushfy"
  spec.license     = "MIT"

  spec.required_ruby_version = ">= 2.7"

  spec.metadata = {
    "homepage_uri"    => spec.homepage,
    "source_code_uri" => "https://github.com/PushfyCpaaS/Pushfy",
    "bug_tracker_uri" => "https://github.com/PushfyCpaaS/Pushfy/issues",
    "documentation_uri" => "https://github.com/PushfyCpaaS/Pushfy/tree/main/sdks/ruby"
  }

  spec.files = Dir[
    "lib/**/*.rb",
    "examples/**/*.rb",
    "README.md",
    "LICENSE"
  ]
  spec.require_paths = ["lib"]

  # Only Ruby standard library is used (net/http, openssl, json, uri, securerandom).
end
