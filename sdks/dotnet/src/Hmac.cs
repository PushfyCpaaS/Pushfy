using System;
using System.Security.Cryptography;
using System.Text;

namespace Pushfy
{
    /// <summary>The result of signing a V2 request: timestamp + hex signature.</summary>
    public readonly struct HmacSignature
    {
        public string Timestamp { get; }
        public string Signature { get; }

        public HmacSignature(string timestamp, string signature)
        {
            Timestamp = timestamp;
            Signature = signature;
        }
    }

    /// <summary>
    /// Builds the canonical string and HMAC-SHA256 signature used by the Pushfy V2
    /// API (Push server + Conversational AI). Must match the server exactly:
    ///
    ///   base      = timestamp + "\n" + METHOD + "\n" + path + "\n" + sha256hex(body)
    ///   signature = hex( HMAC-SHA256(base, secret) )
    ///
    /// <c>path</c> is the route only (e.g. "/v1/conversations"), without the query string.
    /// </summary>
    public static class Hmac
    {
        /// <summary>Sign a request with the canonical Pushfy V2 recipe.</summary>
        /// <param name="method">HTTP method (case-insensitive; upper-cased internally).</param>
        /// <param name="path">Route only, e.g. "/v1/conversations".</param>
        /// <param name="body">Raw request body string ("" for GET/no body).</param>
        /// <param name="secret">HMAC secret (pas_... or pss_...).</param>
        /// <param name="timestamp">Optional Unix seconds; defaults to now.</param>
        public static HmacSignature Sign(string method, string path, string body, string secret, long? timestamp = null)
        {
            var ts = (timestamp ?? DateTimeOffset.UtcNow.ToUnixTimeSeconds()).ToString();
            var bodyHash = Sha256Hex(body ?? string.Empty);
            var baseString = $"{ts}\n{(method ?? string.Empty).ToUpperInvariant()}\n{path}\n{bodyHash}";
            var signature = HmacSha256Hex(baseString, secret);
            return new HmacSignature(ts, signature);
        }

        /// <summary>Lower-case hex SHA-256 of a UTF-8 string.</summary>
        public static string Sha256Hex(string input)
        {
            using var sha = SHA256.Create();
            var hash = sha.ComputeHash(Encoding.UTF8.GetBytes(input ?? string.Empty));
            return ToHex(hash);
        }

        /// <summary>Lower-case hex HMAC-SHA256 of a UTF-8 string with a UTF-8 key.</summary>
        public static string HmacSha256Hex(string input, string secret)
        {
            using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret ?? string.Empty));
            var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(input ?? string.Empty));
            return ToHex(hash);
        }

        /// <summary>Lower-case hex encoding of a byte array.</summary>
        public static string ToHex(byte[] bytes)
        {
            var sb = new StringBuilder(bytes.Length * 2);
            foreach (var b in bytes) sb.Append(b.ToString("x2"));
            return sb.ToString();
        }
    }
}
