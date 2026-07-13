using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;

namespace Pushfy
{
    internal enum AuthMode { None, Pa, Push, Public }

    /// <summary>
    /// Pushfy API client.
    ///
    /// <example>
    /// <code>
    /// var pushfy = new PushfyClient(new PushfyClientOptions { ApiToken = "YOUR_API_TOKEN" });
    /// var res = await pushfy.SendSmsAsync("5511999999999", "Hello");
    /// </code>
    /// </example>
    /// </summary>
    public sealed class PushfyClient : IDisposable
    {
        private static readonly Regex NonDigits = new Regex(@"\D", RegexOptions.Compiled);

        private static readonly JsonSerializerOptions JsonOpts = new JsonSerializerOptions
        {
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
            Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
        };

        private readonly PushfyClientOptions _opts;
        private readonly HttpClient _http;
        private readonly bool _ownsHttp;

        public string? ApiToken => _opts.ApiToken;
        public string? AppId => _opts.AppId;
        public string BaseUrl { get; }

        /// <summary>Push Notifications resource (server + public endpoints).</summary>
        public PushResource Push { get; }

        public PushfyClient(PushfyClientOptions options)
        {
            _opts = options ?? throw new ArgumentNullException(nameof(options));
            BaseUrl = (_opts.BaseUrl ?? "https://portal.pushfy.com").TrimEnd('/');

            if (_opts.HttpClient != null)
            {
                _http = _opts.HttpClient;
                _ownsHttp = false;
            }
            else
            {
                _http = new HttpClient();
                _ownsHttp = true;
            }
            _http.Timeout = TimeSpan.FromMilliseconds(_opts.TimeoutMs > 0 ? _opts.TimeoutMs : 30000);

            Push = new PushResource(this);
        }

        /// <summary>Convenience constructor for the common Bearer-only case.</summary>
        public PushfyClient(string apiToken) : this(new PushfyClientOptions { ApiToken = apiToken }) { }

        // ---- low-level transport ------------------------------------------------

        private async Task<JsonElement> SendAsync(HttpRequestMessage req, CancellationToken ct)
        {
            HttpResponseMessage res;
            try
            {
                res = await _http.SendAsync(req, ct).ConfigureAwait(false);
            }
            catch (OperationCanceledException) when (!ct.IsCancellationRequested)
            {
                throw new ApiException("Network error: request timed out", 0);
            }
            catch (Exception e)
            {
                throw new ApiException($"Network error: {e.Message}", 0);
            }

            var text = res.Content != null ? await res.Content.ReadAsStringAsync().ConfigureAwait(false) : string.Empty;
            JsonElement? parsed = ParseJson(text);

            if (!res.IsSuccessStatusCode)
            {
                int? retryAfter = null;
                if (res.Headers.RetryAfter?.Delta is TimeSpan d) retryAfter = (int)d.TotalSeconds;
                throw ErrorFactory.FromResponse((int)res.StatusCode, NormalizeErrorBody(parsed, text), retryAfter);
            }

            return parsed ?? default;
        }

        private static JsonElement? ParseJson(string? text)
        {
            if (string.IsNullOrEmpty(text)) return null;
            try
            {
                using var doc = JsonDocument.Parse(text);
                return doc.RootElement.Clone();
            }
            catch (JsonException)
            {
                using var doc = JsonDocument.Parse(JsonSerializer.Serialize(new { raw = text }));
                return doc.RootElement.Clone();
            }
        }

        private static JsonElement? NormalizeErrorBody(JsonElement? parsed, string text)
        {
            if (parsed is JsonElement el && el.ValueKind == JsonValueKind.Object) return el;
            using var doc = JsonDocument.Parse(JsonSerializer.Serialize(new { error = string.IsNullOrEmpty(text) ? "error" : text }));
            return doc.RootElement.Clone();
        }

        /// <summary>Messaging (classic) request against https://portal.pushfy.com/&lt;path&gt;.</summary>
        internal Task<JsonElement> ClassicAsync(HttpMethod method, string path, object? json = null,
            HttpContent? form = null, IDictionary<string, string?>? query = null, CancellationToken ct = default)
        {
            var url = BaseUrl + path + BuildQuery(query, path.Contains("?"));
            var req = new HttpRequestMessage(method, url);
            if (!string.IsNullOrEmpty(_opts.ApiToken))
                req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _opts.ApiToken);

            if (form != null)
            {
                req.Content = form; // multipart sets its own Content-Type + boundary
            }
            else if (json != null)
            {
                var body = JsonSerializer.Serialize(json, JsonOpts);
                req.Content = new StringContent(body, Encoding.UTF8, "application/json");
            }

            return SendAsync(req, ct);
        }

        /// <summary>V2 request (Push / Conversational AI) via ?r=&lt;route&gt;.</summary>
        internal Task<JsonElement> V2Async(HttpMethod method, string route, object? body = null,
            IDictionary<string, string?>? query = null, AuthMode auth = AuthMode.None, CancellationToken ct = default)
        {
            var url = new StringBuilder(BaseUrl).Append(_opts.V2Path)
                .Append("?r=").Append(Uri.EscapeDataString(route));
            if (query != null)
                foreach (var kv in query)
                    if (kv.Value != null)
                        url.Append('&').Append(Uri.EscapeDataString(kv.Key)).Append('=').Append(Uri.EscapeDataString(kv.Value));

            var isGet = method == HttpMethod.Get;
            var bodyStr = body != null && !isGet ? JsonSerializer.Serialize(body, JsonOpts) : string.Empty;

            var req = new HttpRequestMessage(method, url.ToString());
            if (!string.IsNullOrEmpty(bodyStr))
                req.Content = new StringContent(bodyStr, Encoding.UTF8, "application/json");

            if (auth == AuthMode.Pa)
            {
                if (string.IsNullOrEmpty(_opts.PaKey) || string.IsNullOrEmpty(_opts.PaSecret))
                    throw new InvalidOperationException("PaKey/PaSecret required for Conversational AI");
                var sig = Hmac.Sign(method.Method, route, bodyStr, _opts.PaSecret!);
                req.Headers.TryAddWithoutValidation("X-PA-Key", _opts.PaKey);
                req.Headers.TryAddWithoutValidation("X-PA-Timestamp", sig.Timestamp);
                req.Headers.TryAddWithoutValidation("X-PA-Signature", sig.Signature);
            }
            else if (auth == AuthMode.Push)
            {
                if (string.IsNullOrEmpty(_opts.PushKey) || string.IsNullOrEmpty(_opts.PushSecret))
                    throw new InvalidOperationException("PushKey/PushSecret required for Push server API");
                var sig = Hmac.Sign(method.Method, route, bodyStr, _opts.PushSecret!);
                req.Headers.TryAddWithoutValidation("X-PUSH-Key", _opts.PushKey);
                req.Headers.TryAddWithoutValidation("X-PUSH-Timestamp", sig.Timestamp);
                req.Headers.TryAddWithoutValidation("X-PUSH-Signature", sig.Signature);
            }

            return SendAsync(req, ct);
        }

        private static string BuildQuery(IDictionary<string, string?>? query, bool hasQuery)
        {
            if (query == null) return string.Empty;
            var sb = new StringBuilder();
            foreach (var kv in query)
            {
                if (kv.Value == null) continue;
                sb.Append(sb.Length == 0 ? (hasQuery ? '&' : '?') : '&');
                sb.Append(Uri.EscapeDataString(kv.Key)).Append('=').Append(Uri.EscapeDataString(kv.Value));
            }
            return sb.ToString();
        }

        internal static string OnlyDigits(string s) => NonDigits.Replace(s ?? string.Empty, string.Empty);

        private static Dictionary<string, object?> ToMessage(string to, string? text, string? extId = null, string? audio = null)
        {
            var m = new Dictionary<string, object?>
            {
                ["destinations"] = new object[] { new Dictionary<string, object?> { ["to"] = OnlyDigits(to) } },
                ["text"] = text,
            };
            if (extId != null) m["ext_id"] = extId;
            if (audio != null) m["audio"] = audio;
            return m;
        }

        // ---- Messaging: SMS -----------------------------------------------------

        /// <summary>Send a single SMS. Returns the API result array.</summary>
        public Task<JsonElement> SendSmsAsync(string to, string text, string? extId = null, CancellationToken ct = default)
        {
            var body = new { messages = new[] { ToMessage(to, text, extId) } };
            return ClassicAsync(HttpMethod.Post, "/webapi", json: body, ct: ct);
        }

        /// <summary>Send many SMS in one request.</summary>
        public Task<JsonElement> SendBulkSmsAsync(IEnumerable<SmsMessage> messages, CancellationToken ct = default)
        {
            var list = new List<Dictionary<string, object?>>();
            foreach (var m in messages) list.Add(ToMessage(m.To, m.Text, m.ExtId));
            var body = new { messages = list };
            return ClassicAsync(HttpMethod.Post, "/webapi", json: body, ct: ct);
        }

        // ---- Messaging: RCS -----------------------------------------------------

        /// <summary>Send an RCS rich card via the API RCS campaign.</summary>
        public Task<JsonElement> SendRcsAsync(string to, string text, string? title = null, string? url = null,
            string? cta = null, string? image = null, string? extId = null, CancellationToken ct = default)
        {
            var msg = new Dictionary<string, object?>
            {
                ["destinations"] = new object[] { new Dictionary<string, object?> { ["to"] = OnlyDigits(to) } },
                ["text"] = text,
            };
            if (title != null) msg["title"] = title;
            if (image != null) msg["image"] = image;
            if (url != null) msg["url"] = url;
            if (cta != null) msg["cta"] = cta;
            if (extId != null) msg["ext_id"] = extId;
            var body = new { messages = new[] { msg } };
            return ClassicAsync(HttpMethod.Post, "/apircsnativo.php", json: body, ct: ct);
        }

        // ---- Messaging: Voice ---------------------------------------------------

        /// <summary>Upload a voice audio (.mp3). Returns the API result.</summary>
        public Task<JsonElement> UploadAudioAsync(string name, byte[] data, string filename = "audio.mp3", CancellationToken ct = default)
        {
            var form = new MultipartFormDataContent();
            form.Add(new StringContent(name ?? filename), "nome");
            var audio = new ByteArrayContent(data ?? Array.Empty<byte>());
            audio.Headers.ContentType = new MediaTypeHeaderValue("audio/mpeg");
            form.Add(audio, "audio", filename);
            return ClassicAsync(HttpMethod.Post, "/audio", form: form, ct: ct);
        }

        /// <summary>Place a voice call by referencing a previously uploaded audio id.</summary>
        public Task<JsonElement> SendVoiceAsync(string to, string audioId, string? extId = null, CancellationToken ct = default)
        {
            var body = new { messages = new[] { ToMessage(to, string.Empty, extId, audioId) } };
            return ClassicAsync(HttpMethod.Post, "/webapi", json: body, ct: ct);
        }

        // ---- Messaging: status, report, balance ---------------------------------

        /// <summary>Delivery status of one message by your ext_id (or internal uid).</summary>
        public Task<JsonElement> GetMessageStatusAsync(string? extId = null, string? uid = null, CancellationToken ct = default)
        {
            var q = new Dictionary<string, string?> { ["ext_id"] = extId, ["uid"] = uid };
            return ClassicAsync(HttpMethod.Get, "/getstatus", query: q, ct: ct);
        }

        /// <summary>Status of every message on a given day (YYYY-MM-DD).</summary>
        public Task<JsonElement> GetMessagesByDateAsync(string date, CancellationToken ct = default)
        {
            var q = new Dictionary<string, string?> { ["date"] = date };
            return ClassicAsync(HttpMethod.Get, "/getdate", query: q, ct: ct);
        }

        /// <summary>Report by date range.</summary>
        public Task<JsonElement> GetReportAsync(ReportQuery query, CancellationToken ct = default)
        {
            var q = new Dictionary<string, string?>
            {
                ["date"] = query.Date,
                ["start"] = query.Start,
                ["end"] = query.End,
                ["event"] = query.Event,
                ["limit"] = query.Limit?.ToString(),
                ["offset"] = query.Offset?.ToString(),
                ["date_dlr"] = query.DateDlr,
            };
            return ClassicAsync(HttpMethod.Get, "/reportbydate", query: q, ct: ct);
        }

        /// <summary>SMS balance. Returns { Raw = "1.500", Balance = 1500 }.</summary>
        public async Task<BalanceResult> GetBalanceAsync(CancellationToken ct = default)
        {
            var res = await ClassicAsync(HttpMethod.Get, "/balance", ct: ct).ConfigureAwait(false);
            string? raw = null;
            if (res.ValueKind == JsonValueKind.Object && res.TryGetProperty("saldo", out var s))
                raw = s.ValueKind == JsonValueKind.String ? s.GetString() : s.ToString();
            long? balance = null;
            if (!string.IsNullOrEmpty(raw))
            {
                var digits = OnlyDigits(raw!);
                if (digits.Length > 0 && long.TryParse(digits, out var n)) balance = n;
            }
            return new BalanceResult(raw, balance);
        }

        // ---- Conversational AI (PushAgent) --------------------------------------

        /// <summary>Open a conversation.</summary>
        public Task<JsonElement> OpenConversationAsync(string userExtId, string? name = null, string? channel = null, CancellationToken ct = default)
        {
            var body = new Dictionary<string, object?> { ["user_ext_id"] = userExtId, ["name"] = name, ["channel"] = channel };
            return V2Async(HttpMethod.Post, "/v1/conversations", body: body, auth: AuthMode.Pa, ct: ct);
        }

        /// <summary>Fetch a conversation and its state.</summary>
        public Task<JsonElement> GetConversationAsync(object id, CancellationToken ct = default)
            => V2Async(HttpMethod.Get, $"/v1/conversations/{id}", auth: AuthMode.Pa, ct: ct);

        /// <summary>Send a user message; the bot replies asynchronously.</summary>
        public Task<JsonElement> PostMessageAsync(object id, string content, CancellationToken ct = default)
        {
            var body = new Dictionary<string, object?> { ["content"] = content };
            return V2Async(HttpMethod.Post, $"/v1/conversations/{id}/messages", body: body, auth: AuthMode.Pa, ct: ct);
        }

        /// <summary>Request a human handoff for a conversation.</summary>
        public Task<JsonElement> HandoffAsync(object id, CancellationToken ct = default)
            => V2Async(HttpMethod.Post, $"/v1/conversations/{id}/handoff", body: new { }, auth: AuthMode.Pa, ct: ct);

        /// <summary>Close a conversation.</summary>
        public Task<JsonElement> CloseAsync(object id, CancellationToken ct = default)
            => V2Async(HttpMethod.Post, $"/v1/conversations/{id}/close", body: new { }, auth: AuthMode.Pa, ct: ct);

        /// <summary>Send a business event.</summary>
        public Task<JsonElement> SendEventAsync(string type, string userExtId, object? data = null, CancellationToken ct = default)
        {
            var body = new Dictionary<string, object?> { ["type"] = type, ["user_ext_id"] = userExtId, ["data"] = data };
            return V2Async(HttpMethod.Post, "/v1/events", body: body, auth: AuthMode.Pa, ct: ct);
        }

        /// <summary>Schedule a follow-up task.</summary>
        public Task<JsonElement> ScheduleTaskAsync(object conversationId, string runAt, string text, CancellationToken ct = default)
        {
            var body = new Dictionary<string, object?> { ["conversation_id"] = conversationId, ["run_at"] = runAt, ["text"] = text };
            return V2Async(HttpMethod.Post, "/v1/tasks", body: body, auth: AuthMode.Pa, ct: ct);
        }

        public void Dispose()
        {
            if (_ownsHttp) _http.Dispose();
        }
    }
}
