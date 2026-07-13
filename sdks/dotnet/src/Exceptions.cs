using System;
using System.Text.Json;

namespace Pushfy
{
    /// <summary>
    /// Base error for every failure surfaced by the SDK.
    /// <see cref="Status"/> is the HTTP status (0 for network/timeout), <see cref="Code"/>
    /// is the API error string (e.g. "unauthorized", "rate_limited") and
    /// <see cref="Response"/> is the parsed body when available.
    /// </summary>
    public class PushfyException : Exception
    {
        /// <summary>HTTP status code, or 0 for network/timeout errors.</summary>
        public int Status { get; }

        /// <summary>API error string (e.g. "unauthorized"), when known.</summary>
        public string? Code { get; }

        /// <summary>Parsed response body, when available.</summary>
        public JsonElement? Response { get; }

        public PushfyException(string message, int status = 0, string? code = null, JsonElement? response = null)
            : base(message)
        {
            Status = status;
            Code = code;
            Response = response;
        }
    }

    /// <summary>401/403 — missing/invalid token or bad HMAC signature.</summary>
    public sealed class AuthenticationException : PushfyException
    {
        public AuthenticationException(string message, int status = 401, string? code = null, JsonElement? response = null)
            : base(message, status, code, response) { }
    }

    /// <summary>400/413/415 and other 4xx — the request was malformed.</summary>
    public sealed class InvalidRequestException : PushfyException
    {
        public InvalidRequestException(string message, int status = 400, string? code = null, JsonElement? response = null)
            : base(message, status, code, response) { }
    }

    /// <summary>429 — rate limited. <see cref="RetryAfter"/> is seconds, when known.</summary>
    public sealed class RateLimitException : PushfyException
    {
        /// <summary>Seconds to wait before retrying, when advertised by the server.</summary>
        public int? RetryAfter { get; }

        public RateLimitException(string message, int status = 429, string? code = null, JsonElement? response = null, int? retryAfter = null)
            : base(message, status, code, response)
        {
            RetryAfter = retryAfter;
        }
    }

    /// <summary>5xx / network / timeout — safe to retry (idempotently).</summary>
    public sealed class ApiException : PushfyException
    {
        public ApiException(string message, int status = 0, string? code = null, JsonElement? response = null)
            : base(message, status, code, response) { }
    }

    internal static class ErrorFactory
    {
        /// <summary>Maps an HTTP status + parsed body to the right exception type.</summary>
        public static PushfyException FromResponse(int status, JsonElement? body, int? retryAfter = null)
        {
            string? code = null;
            if (body is JsonElement el && el.ValueKind == JsonValueKind.Object)
            {
                if (el.TryGetProperty("error", out var e) && e.ValueKind == JsonValueKind.String) code = e.GetString();
                else if (el.TryGetProperty("code", out var c) && c.ValueKind == JsonValueKind.String) code = c.GetString();
            }

            var msg = code != null ? $"Pushfy API error: {code}" : $"Pushfy API error (HTTP {status})";

            if (status == 401 || status == 403) return new AuthenticationException(msg, status, code, body);
            if (status == 429) return new RateLimitException("Rate limited", status, code, body, retryAfter);
            if (status >= 400 && status < 500) return new InvalidRequestException(msg, status, code, body);
            return new ApiException(msg, status, code, body);
        }
    }
}
