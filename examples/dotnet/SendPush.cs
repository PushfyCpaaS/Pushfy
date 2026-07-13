using System;
using System.Threading.Tasks;
using Pushfy;

// Create and send a Push Notifications campaign via the server API.
// The Push server endpoints are HMAC-signed, so this needs PushKey/PushSecret.
//   export PUSHFY_PUSH_KEY=pushk_...
//   export PUSHFY_PUSH_SECRET=pss_...
//   dotnet run
internal static class SendPushExample
{
    public static async Task Main()
    {
        var pushKey = Environment.GetEnvironmentVariable("PUSHFY_PUSH_KEY");
        var pushSecret = Environment.GetEnvironmentVariable("PUSHFY_PUSH_SECRET");
        if (string.IsNullOrEmpty(pushKey) || string.IsNullOrEmpty(pushSecret))
        {
            Console.Error.WriteLine("Set PUSHFY_PUSH_KEY and PUSHFY_PUSH_SECRET in your environment.");
            Environment.Exit(2);
        }

        using var pushfy = new PushfyClient(new PushfyClientOptions
        {
            PushKey = pushKey,
            PushSecret = pushSecret,
        });

        try
        {
            var campaign = await pushfy.Push.Campaigns.CreateAsync(new
            {
                name = "Promo July",
                title = "Sale!",
                body = "50% off today only",
                url = "https://example.com/sale",
            });
            var id = campaign.GetProperty("id").GetInt32();
            Console.WriteLine($"Created campaign {id}");

            await pushfy.Push.Campaigns.SendAsync(id);
            Console.WriteLine($"Campaign {id} sent.");

            var metrics = await pushfy.Push.Campaigns.MetricsAsync(id);
            Console.WriteLine("Metrics: " + metrics);
        }
        catch (RateLimitException err)
        {
            Console.Error.WriteLine($"Rate limited. Retry after {err.RetryAfter}s.");
            Environment.Exit(1);
        }
        catch (AuthenticationException err)
        {
            Console.Error.WriteLine($"Auth failed ({err.Status}). Check push key/secret.");
            Environment.Exit(1);
        }
        catch (ApiException err)
        {
            Console.Error.WriteLine($"Transient failure: {err.Status} {err.Message}");
            Environment.Exit(1);
        }
    }
}
