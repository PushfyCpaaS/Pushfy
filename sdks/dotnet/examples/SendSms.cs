using System;
using System.Threading.Tasks;
using Pushfy;

// Send an SMS with the Pushfy .NET SDK.
//   dotnet run --project examples
// Requires PUSHFY_API_TOKEN in your environment.
internal static class SendSmsExample
{
    public static async Task Main()
    {
        var pushfy = new PushfyClient(new PushfyClientOptions
        {
            ApiToken = Environment.GetEnvironmentVariable("PUSHFY_API_TOKEN"),
        });

        try
        {
            var result = await pushfy.SendSmsAsync(
                to: "5511999999999",
                text: "Hello from the Pushfy .NET SDK",
                extId: "demo-" + DateTimeOffset.UtcNow.ToUnixTimeSeconds());

            Console.WriteLine("Accepted: " + result);
        }
        catch (RateLimitException)
        {
            Console.Error.WriteLine("Rate limited — back off and retry.");
            Environment.Exit(1);
        }
        catch (PushfyException err)
        {
            Console.Error.WriteLine($"Failed: {err.Status} {err.Code} {err.Response}");
            Environment.Exit(1);
        }
    }
}
