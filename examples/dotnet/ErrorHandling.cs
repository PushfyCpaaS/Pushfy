using System;
using System.Threading.Tasks;
using Pushfy;

// Branch on the typed Pushfy exceptions. Every failure throws a PushfyException
// subclass; catch the specific ones first, then fall through to the base.
//
// Hierarchy: PushfyException is the base of AuthenticationException,
// InvalidRequestException, RateLimitException and ApiException.
internal static class ErrorHandlingExample
{
    public static async Task Main()
    {
        var token = Environment.GetEnvironmentVariable("PUSHFY_API_TOKEN");
        using var pushfy = new PushfyClient(new PushfyClientOptions { ApiToken = token });

        try
        {
            var result = await pushfy.SendSmsAsync("5511999999999", "Hi", extId: "err-demo-1");
            Console.WriteLine("Accepted: " + result);
        }
        catch (RateLimitException err)
        {
            // 429 — back off and retry; RetryAfter is seconds when the server told us.
            Console.Error.WriteLine($"Rate limited. RetryAfter={err.RetryAfter}s");
        }
        catch (AuthenticationException err)
        {
            // 401/403 — bad token or HMAC credentials.
            Console.Error.WriteLine($"Auth error ({err.Status}): check your credentials");
        }
        catch (InvalidRequestException err)
        {
            // 400/413/415 — the request was malformed; do NOT retry unchanged.
            Console.Error.WriteLine($"Invalid request ({err.Status}): {err.Code}");
        }
        catch (ApiException err)
        {
            // 5xx / network / timeout — safe to retry idempotently (reuse the extId).
            Console.Error.WriteLine($"Transient error ({err.Status}): retry later");
        }
        catch (PushfyException err)
        {
            // Anything else the SDK surfaces.
            Console.Error.WriteLine($"Pushfy error: {err.Status} {err.Code} {err.Response}");
        }
    }
}
