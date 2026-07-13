# frozen_string_literal: true

require_relative "pushfy/version"
require_relative "pushfy/errors"
require_relative "pushfy/hmac"
require_relative "pushfy/webhooks"
require_relative "pushfy/client"

# Official Ruby SDK for the Pushfy API — SMS, RCS, Voice, Push Notifications
# and Conversational AI.
#
# @example
#   require "pushfy"
#   pushfy = Pushfy::Client.new(api_token: "YOUR_API_TOKEN")
#   pushfy.sms.send(to: "5511999999999", text: "Hello from Pushfy")
module Pushfy
end
