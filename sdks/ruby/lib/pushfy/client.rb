# frozen_string_literal: true

require "net/http"
require "uri"
require "json"
require "securerandom"

require_relative "hmac"
require_relative "errors"

module Pushfy
  DEFAULT_BASE = "https://portal.pushfy.com"
  DEFAULT_V2_PATH = "/v2/api.php"

  # Pushfy API client.
  #
  # @example
  #   pushfy = Pushfy::Client.new(api_token: "YOUR_API_TOKEN")
  #   res = pushfy.sms.send(to: "5511999999999", text: "Hello")
  class Client
    attr_reader :api_token, :pa_key, :pa_secret, :push_key, :push_secret,
                :app_id, :base_url, :v2_path, :timeout
    attr_reader :sms, :rcs, :voice, :messages, :balance, :push,
                :conversations, :events, :tasks

    # @param api_token   [String] Messaging Bearer token.
    # @param pa_key      [String] Conversational AI HMAC key (pak_...).
    # @param pa_secret   [String] Conversational AI HMAC secret (pas_...).
    # @param push_key    [String] Push server HMAC key (pushk_...).
    # @param push_secret [String] Push server HMAC secret (pss_...).
    # @param app_id      [String] Public Push app id (pushapp_...).
    # @param base_url    [String] Defaults to https://portal.pushfy.com.
    # @param timeout     [Numeric] Request timeout in seconds (default 30).
    def initialize(api_token: nil, pa_key: nil, pa_secret: nil, push_key: nil,
                   push_secret: nil, app_id: nil, base_url: DEFAULT_BASE,
                   v2_path: DEFAULT_V2_PATH, timeout: 30, http: nil)
      @api_token = api_token
      @pa_key = pa_key
      @pa_secret = pa_secret
      @push_key = push_key
      @push_secret = push_secret
      @app_id = app_id
      @base_url = (base_url || DEFAULT_BASE).sub(%r{/\z}, "")
      @v2_path = v2_path || DEFAULT_V2_PATH
      @timeout = timeout || 30
      # Optional injectable transport (used by tests); must respond to
      # #call(url, method:, headers:, body:) -> { status:, body: <String> }.
      @http = http

      @sms = SmsResource.new(self)
      @rcs = RcsResource.new(self)
      @voice = VoiceResource.new(self)
      @messages = MessagesResource.new(self)
      @balance = BalanceResource.new(self)
      @push = PushResource.new(self)
      @conversations = ConversationsResource.new(self)
      @events = EventsResource.new(self)
      @tasks = TasksResource.new(self)
    end

    # Webhook signature helpers (no credentials needed).
    def self.webhooks
      Pushfy::Webhooks
    end

    # ---- low-level transport ------------------------------------------------

    def _http(url, method:, headers: {}, body: nil)
      status, text = @http ? _via_injected(url, method, headers, body) : _via_net(url, method, headers, body)

      parsed = nil
      unless text.nil? || text.empty?
        begin
          parsed = JSON.parse(text)
        rescue JSON::ParserError
          parsed = { "raw" => text }
        end
      end

      unless status >= 200 && status < 300
        err_body =
          if parsed.is_a?(Hash)
            parsed["error"] ? parsed : { "error" => parsed["raw"] || text }
          else
            { "error" => text.is_a?(String) ? text : "error" }
          end
        raise Pushfy.error_from_response(status, err_body)
      end

      parsed
    end

    # Messaging (classic) request against https://portal.pushfy.com/<path>.
    def _classic(method, path, json: :__none, form: nil, query: nil)
      url = @base_url + path
      if query
        qs = _encode_query(query)
        url += (path.include?("?") ? "&" : "?") + qs unless qs.empty?
      end

      headers = {}
      headers["Authorization"] = "Bearer #{@api_token}" if @api_token
      body = nil

      if form
        boundary = "pushfy#{SecureRandom.hex(16)}"
        headers["Content-Type"] = "multipart/form-data; boundary=#{boundary}"
        body = _multipart(form, boundary)
      elsif json != :__none
        headers["Content-Type"] = "application/json"
        body = JSON.generate(json)
      end

      _http(url, method: method, headers: headers, body: body)
    end

    # V2 request (Push / Conversational AI) via ?r=<route>.
    def _v2(method, route, body: :__none, query: nil, auth: nil)
      params = { "r" => route }
      query&.each { |k, v| params[k.to_s] = v unless v.nil? }
      url = "#{@base_url}#{@v2_path}?#{_encode_query(params)}"

      body_str = body != :__none && method != "GET" ? JSON.generate(body) : ""
      headers = {}
      headers["Content-Type"] = "application/json" unless body_str.empty?

      case auth
      when "pa"
        raise ArgumentError, "pa_key/pa_secret required for Conversational AI" unless @pa_key && @pa_secret

        sig = Hmac.sign(method: method, path: route, body: body_str, secret: @pa_secret)
        headers["X-PA-Key"] = @pa_key
        headers["X-PA-Timestamp"] = sig[:timestamp]
        headers["X-PA-Signature"] = sig[:signature]
      when "push"
        raise ArgumentError, "push_key/push_secret required for Push server API" unless @push_key && @push_secret

        sig = Hmac.sign(method: method, path: route, body: body_str, secret: @push_secret)
        headers["X-PUSH-Key"] = @push_key
        headers["X-PUSH-Timestamp"] = sig[:timestamp]
        headers["X-PUSH-Signature"] = sig[:signature]
      end

      _http(url, method: method, headers: headers, body: body_str.empty? ? nil : body_str)
    end

    private

    def _via_injected(url, method, headers, body)
      res = @http.call(url, method: method, headers: headers, body: body)
      [res[:status] || res["status"] || 200, res[:body] || res["body"] || ""]
    end

    def _via_net(url, method, headers, body)
      uri = URI.parse(url)
      klass = {
        "GET" => Net::HTTP::Get, "POST" => Net::HTTP::Post,
        "PATCH" => Net::HTTP::Patch, "PUT" => Net::HTTP::Put,
        "DELETE" => Net::HTTP::Delete
      }[method] || Net::HTTP::Get

      req = klass.new(uri.request_uri)
      headers.each { |k, v| req[k] = v }
      req.body = body if body

      http = Net::HTTP.new(uri.host, uri.port)
      http.use_ssl = uri.scheme == "https"
      http.open_timeout = @timeout
      http.read_timeout = @timeout

      res = http.request(req)
      [res.code.to_i, res.body.to_s]
    rescue StandardError => e
      raise Pushfy::ApiError.new("Network error: #{e.message}", status: 0)
    end

    def _encode_query(hash)
      hash.reject { |_, v| v.nil? }
          .map { |k, v| "#{URI.encode_www_form_component(k.to_s)}=#{URI.encode_www_form_component(v.to_s)}" }
          .join("&")
    end

    # Builds a multipart/form-data body. `parts` values are either strings or
    # { filename:, content_type:, data: } hashes.
    def _multipart(parts, boundary)
      out = +""
      parts.each do |name, value|
        out << "--#{boundary}\r\n"
        if value.is_a?(Hash) && value[:data]
          fn = value[:filename] || "file"
          ct = value[:content_type] || "application/octet-stream"
          out << %(Content-Disposition: form-data; name="#{name}"; filename="#{fn}"\r\n)
          out << "Content-Type: #{ct}\r\n\r\n"
          out << value[:data].to_s.b
        else
          out << %(Content-Disposition: form-data; name="#{name}"\r\n\r\n)
          out << value.to_s
        end
        out << "\r\n"
      end
      out << "--#{boundary}--\r\n"
      out
    end
  end

  # --------------------------------------------------------------------------
  # Shared helpers
  # --------------------------------------------------------------------------

  # Normalizes a messaging destination to the API wire shape.
  def self.to_message(to:, text:, ext_id: nil, audio: nil)
    out = { "destinations" => [{ "to" => to.to_s.gsub(/\D/, "") }], "text" => text }
    out["ext_id"] = ext_id if ext_id
    out["audio"] = audio if audio
    out
  end

  # --------------------------------------------------------------------------
  # Messaging resources
  # --------------------------------------------------------------------------

  class SmsResource
    def initialize(client)
      @c = client
    end

    # Send a single SMS. Returns the API result array.
    def send(to:, text:, ext_id: nil)
      @c._classic("POST", "/webapi", json: { messages: [Pushfy.to_message(to: to, text: text, ext_id: ext_id)] })
    end

    # Send many SMS in one request. `list` = [{ to:, text:, ext_id: }].
    def send_bulk(list = [])
      messages = list.map { |m| Pushfy.to_message(to: m[:to], text: m[:text], ext_id: m[:ext_id]) }
      @c._classic("POST", "/webapi", json: { messages: messages })
    end
  end

  class RcsResource
    def initialize(client)
      @c = client
    end

    # Send an RCS rich card via the API RCS campaign.
    def send(to:, text:, title: nil, url: nil, cta: nil, image: nil, ext_id: nil)
      msg = { "destinations" => [{ "to" => to.to_s.gsub(/\D/, "") }], "text" => text }
      msg["title"] = title if title
      msg["image"] = image if image
      msg["url"] = url if url
      msg["cta"] = cta if cta
      msg["ext_id"] = ext_id if ext_id
      @c._classic("POST", "/apircsnativo.php", json: { messages: [msg] })
    end
  end

  class VoiceResource
    def initialize(client)
      @c = client
    end

    # Upload a voice audio (.mp3). `data` is the raw mp3 bytes. Returns the API result.
    def upload_audio(name: nil, data:, filename: "audio.mp3")
      form = {
        "nome" => name || filename,
        "audio" => { filename: filename, content_type: "audio/mpeg", data: data }
      }
      @c._classic("POST", "/audio", form: form)
    end

    # Place a voice call by referencing a previously uploaded audio id.
    def send(to:, audio_id:, ext_id: nil)
      msg = Pushfy.to_message(to: to, text: "", ext_id: ext_id, audio: audio_id)
      @c._classic("POST", "/webapi", json: { messages: [msg] })
    end
  end

  class MessagesResource
    def initialize(client)
      @c = client
    end

    # Delivery status of one message by your ext_id (or internal uid).
    def status(ext_id: nil, uid: nil)
      @c._classic("GET", "/getstatus", query: { ext_id: ext_id, uid: uid })
    end

    # Status of every message on a given day (YYYY-MM-DD).
    def by_date(date)
      @c._classic("GET", "/getdate", query: { date: date })
    end

    # Report by date range. { date, start, end, event, limit, offset, date_dlr }.
    def report(date: nil, start: nil, finish: nil, event: nil, limit: nil, offset: nil, date_dlr: nil)
      @c._classic("GET", "/reportbydate", query: {
                    date: date, start: start, end: finish, event: event,
                    limit: limit, offset: offset, date_dlr: date_dlr
                  })
    end
  end

  class BalanceResource
    def initialize(client)
      @c = client
    end

    # SMS balance. Returns { raw: "1.500", balance: 1500 }.
    def get
      res = @c._classic("GET", "/balance")
      raw = res.is_a?(Hash) && !res["saldo"].nil? ? res["saldo"].to_s : nil
      { raw: raw, balance: raw ? raw.gsub(/\D/, "").to_i : nil }
    end
  end

  # --------------------------------------------------------------------------
  # Push Notifications
  # --------------------------------------------------------------------------

  class PushResource
    attr_reader :devices, :campaigns, :segments

    def initialize(client)
      @c = client
      @devices = Devices.new(client)
      @campaigns = Campaigns.new(client)
      @segments = Segments.new(client)
    end

    # Send a test push.
    def test(body)
      @c._v2("POST", "/v1/push/test", body: body, auth: "push")
    end

    # Public: subscribe a device (browser/app). Injects app_id automatically.
    def subscribe(body)
      @c._v2("POST", "/v1/push/subscribe", body: { app_id: @c.app_id }.merge(body), auth: "public")
    end

    # Public: report a device event.
    def track(body)
      @c._v2("POST", "/v1/push/track", body: { app_id: @c.app_id }.merge(body), auth: "public")
    end

    class Devices
      def initialize(client)
        @c = client
      end

      def list(query = nil)
        @c._v2("GET", "/v1/push/devices", query: query, auth: "push")
      end

      def register(body)
        @c._v2("POST", "/v1/push/devices", body: body, auth: "push")
      end

      def remove(id)
        @c._v2("DELETE", "/v1/push/devices/#{id}", auth: "push")
      end
    end

    class Campaigns
      def initialize(client)
        @c = client
      end

      def list(query = nil)
        @c._v2("GET", "/v1/push/campaigns", query: query, auth: "push")
      end

      def create(body)
        @c._v2("POST", "/v1/push/campaigns", body: body, auth: "push")
      end

      def get(id)
        @c._v2("GET", "/v1/push/campaigns/#{id}", auth: "push")
      end

      def update(id, body)
        @c._v2("PATCH", "/v1/push/campaigns/#{id}", body: body, auth: "push")
      end

      def send(id)
        @c._v2("POST", "/v1/push/campaigns/#{id}/send", body: {}, auth: "push")
      end

      def metrics(id)
        @c._v2("GET", "/v1/push/campaigns/#{id}/metrics", auth: "push")
      end
    end

    class Segments
      def initialize(client)
        @c = client
      end

      def list(query = nil)
        @c._v2("GET", "/v1/push/segments", query: query, auth: "push")
      end

      def create(body)
        @c._v2("POST", "/v1/push/segments", body: body, auth: "push")
      end
    end
  end

  # --------------------------------------------------------------------------
  # Conversational AI (PushAgent)
  # --------------------------------------------------------------------------

  class ConversationsResource
    def initialize(client)
      @c = client
    end

    # Open a conversation. { user_ext_id, name, channel }.
    def open(user_ext_id: nil, name: nil, channel: nil)
      @c._v2("POST", "/v1/conversations",
             body: { user_ext_id: user_ext_id, name: name, channel: channel }, auth: "pa")
    end

    def get(id)
      @c._v2("GET", "/v1/conversations/#{id}", auth: "pa")
    end

    # Send a user message; the bot replies asynchronously.
    def message(id, content:)
      @c._v2("POST", "/v1/conversations/#{id}/messages", body: { content: content }, auth: "pa")
    end

    def handoff(id)
      @c._v2("POST", "/v1/conversations/#{id}/handoff", body: {}, auth: "pa")
    end

    def close(id)
      @c._v2("POST", "/v1/conversations/#{id}/close", body: {}, auth: "pa")
    end
  end

  class EventsResource
    def initialize(client)
      @c = client
    end

    # Send a business event. { type, user_ext_id, data }.
    def send(type:, user_ext_id: nil, data: nil)
      @c._v2("POST", "/v1/events", body: { type: type, user_ext_id: user_ext_id, data: data }, auth: "pa")
    end
  end

  class TasksResource
    def initialize(client)
      @c = client
    end

    # Schedule a follow-up. { conversation_id, run_at, text }.
    def schedule(conversation_id:, run_at:, text:)
      @c._v2("POST", "/v1/tasks",
             body: { conversation_id: conversation_id, run_at: run_at, text: text }, auth: "pa")
    end
  end
end
