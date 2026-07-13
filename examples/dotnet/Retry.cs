using System;
using System.Text.Json;
using System.Threading.Tasks;
using Pushfy;

// Retry a send with exponential backoff, idempotently.
//
// The golden rule: never blindly resend after a timeout — you may double charge.
// Instead reuse the SAME extId on every attempt so the API can de-duplicate, and
// only retry the retryable errors (RateLimitException and ApiException). A
// malformed request (4xx) is not retried.
internal static class RetryExample
{
    private const int MaxAttempts = 5;
    private const int BaseDelayMs = 500;
    private static readonly Random Rng = new Random();

    public static async Task Main()
    {
        var token = Environment.GetEnvironmentVariable("PUSHFY_API_TOKEN");
        using var pushfy = new PushfyClient(new PushfyClientOptions { ApiToken = token });

        // A single, stable ext_id shared across all attempts keeps the send idempotent.
        var extId = "retry-" + DateTimeOffset.UtcNow.ToUnixTimeSeconds();

        var result = await SendWithRetryAsync(pushfy, "5511999999999", "Hello (with retry)", extId);
        if (result is JsonElement r)
        {
            Console.WriteLine("Accepted after retry: " + r);
        }
        else
        {
            Console.Error.WriteLine($"Giving up after {MaxAttempts} attempts.");
            Environment.Exit(1);
        }
    }

    private static async Task<JsonElement?> SendWithRetryAsync(PushfyClient pushfy, string to, string text, string extId)
    {
        for (var attempt = 1; attempt <= MaxAttempts; attempt++)
        {
            try
            {
                return await pushfy.SendSmsAsync(to, text, extId: extId);
            }
            catch (RateLimitException err)
            {
                // Honour the server's Retry-After when present, else back off.
                var delay = err.RetryAfter.HasValue ? err.RetryAfter.Value * 1000 : Backoff(attempt);
                Console.Error.WriteLine($"Attempt {attempt} rate limited; waiting {delay}ms");
                if (attempt == MaxAttempts) return null;
                await Task.Delay(delay);
            }
            catch (ApiException err)
            {
                // 5xx / network / timeout — retryable because extId makes it idempotent.
                var delay = Backoff(attempt);
                Console.Error.WriteLine($"Attempt {attempt} failed ({err.Status}); waiting {delay}ms");
                if (attempt == MaxAttempts) return null;
                await Task.Delay(delay);
            }
            catch (PushfyException err)
            {
                // 4xx (auth / invalid request) — not retryable, fail fast.
                Console.Error.WriteLine($"Non-retryable error: {err.Status} {err.Code}");
                return null;
            }
        }
        return null;
    }

    // Exponential backoff with jitter: base * 2^(attempt-1) + [0, base).
    private static int Backoff(int attempt)
    {
        var exp = BaseDelayMs * (1 << (attempt - 1));
        var jitter = Rng.Next(BaseDelayMs);
        return exp + jitter;
    }
}
