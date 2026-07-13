using System;
using System.Security.Cryptography;
using System.Text;

namespace Pushfy
{
    /// <summary>Signature encoding used by an incoming webhook header.</summary>
    public enum WebhookScheme
    {
        /// <summary>Header value is <c>sha256=&lt;hex&gt;</c> (X-Pushfy-Signature / X-Push-Signature).</summary>
        Prefixed = 0,

        /// <summary>Header value is the raw hex digest (X-PA-Signature — Conversational AI).</summary>
        Raw = 1,
    }

    /// <summary>
    /// Verifies the authenticity of an incoming Pushfy webhook.
    ///
    /// Signature header differs by product:
    ///   - Messaging status   -> X-Pushfy-Signature: sha256=&lt;hex&gt;   (<see cref="WebhookScheme.Prefixed"/>)
    ///   - Push Notifications -> X-Push-Signature:   sha256=&lt;hex&gt;   (<see cref="WebhookScheme.Prefixed"/>)
    ///   - Conversational AI  -> X-PA-Signature:      &lt;hex&gt;          (<see cref="WebhookScheme.Raw"/>)
    ///
    /// Always pass the RAW request body (the exact bytes received), not a
    /// re-serialized object — re-serialization changes the signature.
    /// </summary>
    public static class Webhooks
    {
        /// <summary>Verify a signature over a raw string payload.</summary>
        public static bool Verify(string payload, string? signature, string secret, WebhookScheme scheme = WebhookScheme.Prefixed)
        {
            return Verify(Encoding.UTF8.GetBytes(payload ?? string.Empty), signature, secret, scheme);
        }

        /// <summary>Verify a signature over the raw request body bytes.</summary>
        public static bool Verify(byte[] payload, string? signature, string secret, WebhookScheme scheme = WebhookScheme.Prefixed)
        {
            if (string.IsNullOrEmpty(signature) || string.IsNullOrEmpty(secret)) return false;

            using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
            var hex = Hmac.ToHex(hmac.ComputeHash(payload ?? Array.Empty<byte>()));
            var expected = scheme == WebhookScheme.Raw ? hex : $"sha256={hex}";

            var a = Encoding.UTF8.GetBytes(expected);
            var b = Encoding.UTF8.GetBytes(signature!);
            // FixedTimeEquals returns false for different lengths without leaking timing.
            return CryptographicOperations.FixedTimeEquals(a, b);
        }

        /// <summary>Messaging status/DLR webhook (X-Pushfy-Signature, <c>sha256=</c>).</summary>
        public static bool Messaging(string payload, string? signature, string secret)
            => Verify(payload, signature, secret, WebhookScheme.Prefixed);

        public static bool Messaging(byte[] payload, string? signature, string secret)
            => Verify(payload, signature, secret, WebhookScheme.Prefixed);

        /// <summary>Push Notifications webhook (X-Push-Signature, <c>sha256=</c>).</summary>
        public static bool Push(string payload, string? signature, string secret)
            => Verify(payload, signature, secret, WebhookScheme.Prefixed);

        public static bool Push(byte[] payload, string? signature, string secret)
            => Verify(payload, signature, secret, WebhookScheme.Prefixed);

        /// <summary>Conversational AI webhook (X-PA-Signature, raw hex).</summary>
        public static bool Conversations(string payload, string? signature, string secret)
            => Verify(payload, signature, secret, WebhookScheme.Raw);

        public static bool Conversations(byte[] payload, string? signature, string secret)
            => Verify(payload, signature, secret, WebhookScheme.Raw);
    }
}
