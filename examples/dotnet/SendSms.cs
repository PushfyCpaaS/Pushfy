using System;
using System.Threading.Tasks;
using Pushfy;

// Send a single SMS with the Pushfy .NET SDK.
//   export PUSHFY_API_TOKEN=...
//   dotnet run
internal static class SendSmsExample
{
    public static async Task Main()
    {
        var token = Environment.GetEnvironmentVariable("PUSHFY_API_TOKEN");
        if (string.IsNullOrEmpty(token))
        {
            Console.Error.WriteLine("Set PUSHFY_API_TOKEN in your environment.");
            Environment.Exit(2);
        }

        using var pushfy = new PushfyClient(new PushfyClientOptions { ApiToken = token });

        // A stable ext_id lets you look up delivery status and makes a retry idempotent.
        var extId = "welcome-" + DateTimeOffset.UtcNow.ToUnixTimeSeconds();

        try
        {
            var result = await pushfy.SendSmsAsync(
                to: "5511999999999",
                text: "Hello from the Pushfy .NET SDK",
                extId: extId);
            Console.WriteLine("Accepted: " + result);

            var status = await pushfy.GetMessageStatusAsync(extId: extId);
            Console.WriteLine("Status: " + status);
        }
        catch (RateLimitException err)
        {
            Console.Error.WriteLine($"Rate limited. Retry after {err.RetryAfter}s.");
            Environment.Exit(1);
        }
        catch (AuthenticationException err)
        {
            Console.Error.WriteLine($"Auth failed ({err.Status}). Check PUSHFY_API_TOKEN.");
            Environment.Exit(1);
        }
        catch (ApiException err)
        {
            // 5xx / network / timeout: safe to retry idempotently reusing extId.
            Console.Error.WriteLine($"Transient failure: {err.Status} {err.Message}");
            Environment.Exit(1);
        }
    }
}
