using System;
using System.Threading.Tasks;
using Pushfy;

// Send several SMS in one request with SendBulkSmsAsync.
//   export PUSHFY_API_TOKEN=...
//   dotnet run
internal static class SendBulkSmsExample
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

        var messages = new[]
        {
            new SmsMessage("5511999999999", "Hi Ana, your code is 1234",   "bulk-ana"),
            new SmsMessage("5511999999999", "Hi Bruno, your code is 5678", "bulk-bruno"),
            new SmsMessage("5511999999999", "Hi Carla, your code is 9012", "bulk-carla"),
        };

        try
        {
            var result = await pushfy.SendBulkSmsAsync(messages);
            Console.WriteLine($"Accepted {messages.Length} messages: {result}");
        }
        catch (RateLimitException err)
        {
            Console.Error.WriteLine($"Rate limited. Retry after {err.RetryAfter}s.");
            Environment.Exit(1);
        }
        catch (ApiException err)
        {
            Console.Error.WriteLine($"Transient failure: {err.Status} {err.Message}");
            Environment.Exit(1);
        }
    }
}
