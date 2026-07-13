using System.Net.Http;

namespace Pushfy
{
    /// <summary>Configuration for <see cref="PushfyClient"/>. Pass only the credentials you need.</summary>
    public sealed class PushfyClientOptions
    {
        /// <summary>Messaging Bearer token (SMS/RCS/Voice, status, balance).</summary>
        public string? ApiToken { get; set; }

        /// <summary>Conversational AI HMAC key (pak_...).</summary>
        public string? PaKey { get; set; }

        /// <summary>Conversational AI HMAC secret (pas_...).</summary>
        public string? PaSecret { get; set; }

        /// <summary>Push server HMAC key (pushk_...).</summary>
        public string? PushKey { get; set; }

        /// <summary>Push server HMAC secret (pss_...).</summary>
        public string? PushSecret { get; set; }

        /// <summary>Public Push app id (pushapp_...).</summary>
        public string? AppId { get; set; }

        /// <summary>API base URL. Defaults to https://portal.pushfy.com.</summary>
        public string BaseUrl { get; set; } = "https://portal.pushfy.com";

        /// <summary>V2 API path. Defaults to /v2/api.php.</summary>
        public string V2Path { get; set; } = "/v2/api.php";

        /// <summary>Request timeout in milliseconds (default 30000).</summary>
        public int TimeoutMs { get; set; } = 30000;

        /// <summary>Optional custom <see cref="HttpClient"/> (e.g. for tests or a proxy).</summary>
        public HttpClient? HttpClient { get; set; }
    }

    /// <summary>A single outbound SMS in a bulk send.</summary>
    public sealed class SmsMessage
    {
        public string To { get; set; } = string.Empty;
        public string? Text { get; set; }
        public string? ExtId { get; set; }

        public SmsMessage() { }

        public SmsMessage(string to, string? text, string? extId = null)
        {
            To = to;
            Text = text;
            ExtId = extId;
        }
    }

    /// <summary>Report query filters. Any null field is omitted.</summary>
    public sealed class ReportQuery
    {
        public string? Date { get; set; }
        public string? Start { get; set; }
        public string? End { get; set; }
        public string? Event { get; set; }
        public int? Limit { get; set; }
        public int? Offset { get; set; }
        public string? DateDlr { get; set; }
    }

    /// <summary>SMS balance parsed from the formatted API string.</summary>
    public sealed class BalanceResult
    {
        /// <summary>The raw formatted value as returned by the API, e.g. "1.500".</summary>
        public string? Raw { get; }

        /// <summary>The numeric balance, e.g. 1500. Null when the API returned nothing.</summary>
        public long? Balance { get; }

        public BalanceResult(string? raw, long? balance)
        {
            Raw = raw;
            Balance = balance;
        }
    }
}
