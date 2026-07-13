using System;
using System.Threading.Tasks;
using Pushfy;

// Send an RCS rich card with SendRcsAsync.
// Only `to` and `text` are required; the rest turn it into a rich card with a button.
//   export PUSHFY_API_TOKEN=...
//   dotnet run
internal static class SendRcsExample
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

        try
        {
            var result = await pushfy.SendRcsAsync(
                to: "5511999999999",
                text: "Your order #1042 is on the way",
                title: "Order shipped",
                image: "https://cdn.example.com/box.jpg",
                url: "https://example.com/track/1042",
                cta: "Track order",
                extId: "rcs-order-1042");
            Console.WriteLine("Accepted: " + result);
        }
        catch (RateLimitException err)
        {
            Console.Error.WriteLine($"Rate limited. Retry after {err.RetryAfter}s.");
            Environment.Exit(1);
        }
        catch (InvalidRequestException err)
        {
            Console.Error.WriteLine($"Malformed RCS card: {err.Message}");
            Environment.Exit(1);
        }
        catch (ApiException err)
        {
            Console.Error.WriteLine($"Transient failure: {err.Status} {err.Message}");
            Environment.Exit(1);
        }
    }
}
