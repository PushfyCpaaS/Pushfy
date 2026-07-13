using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Pushfy;

// Send a large audience by splitting it into chunks and calling SendBulkSmsAsync
// once per chunk. Chunking keeps each request within API limits and lets you
// pace the traffic. A per-recipient ext_id keeps every message trackable.
internal static class BatchSendExample
{
    private const int ChunkSize = 500;

    public static async Task Main()
    {
        var token = Environment.GetEnvironmentVariable("PUSHFY_API_TOKEN");
        using var pushfy = new PushfyClient(new PushfyClientOptions { ApiToken = token });

        // Build a demo audience. In production this comes from your database.
        var audience = new List<SmsMessage>();
        for (var i = 0; i < 1200; i++)
        {
            audience.Add(new SmsMessage("5511999999999", $"Batch message #{i}", $"batch-{i}"));
        }

        var chunks = Chunk(audience, ChunkSize);
        Console.WriteLine($"Sending {audience.Count} messages in {chunks.Count} chunks");

        var sent = 0;
        for (var c = 0; c < chunks.Count; c++)
        {
            var batch = chunks[c];
            try
            {
                await pushfy.SendBulkSmsAsync(batch);
                sent += batch.Count;
                Console.WriteLine($"Chunk {c + 1}/{chunks.Count} accepted ({batch.Count} msgs)");
            }
            catch (RateLimitException err)
            {
                var delay = err.RetryAfter.HasValue ? err.RetryAfter.Value * 1000 : 2000;
                Console.Error.WriteLine($"Chunk {c + 1} rate limited; pausing {delay}ms and retrying");
                await Task.Delay(delay);
                await pushfy.SendBulkSmsAsync(batch); // retry once; extIds keep it idempotent
                sent += batch.Count;
            }
            catch (ApiException err)
            {
                Console.Error.WriteLine($"Chunk {c + 1} failed ({err.Status}): {err.Message}");
            }

            // Gentle pacing between chunks.
            await Task.Delay(200);
        }

        Console.WriteLine($"Done. Accepted {sent}/{audience.Count} messages.");
    }

    // Split a list into consecutive sublists of at most `size` elements.
    private static List<List<T>> Chunk<T>(List<T> items, int size)
    {
        var chunks = new List<List<T>>();
        for (var i = 0; i < items.Count; i += size)
        {
            chunks.Add(items.GetRange(i, Math.Min(size, items.Count - i)));
        }
        return chunks;
    }
}
