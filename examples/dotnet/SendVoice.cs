using System;
using System.IO;
using System.Text.Json;
using System.Threading.Tasks;
using Pushfy;

// Place a voice call: upload an .mp3, then dial a number referencing it.
//   export PUSHFY_API_TOKEN=...
//   export AUDIO_PATH=./welcome.mp3
//   dotnet run
internal static class SendVoiceExample
{
    public static async Task Main()
    {
        var token = Environment.GetEnvironmentVariable("PUSHFY_API_TOKEN");
        var audioPath = Environment.GetEnvironmentVariable("AUDIO_PATH");
        if (string.IsNullOrEmpty(token) || string.IsNullOrEmpty(audioPath))
        {
            Console.Error.WriteLine("Set PUSHFY_API_TOKEN and AUDIO_PATH in your environment.");
            Environment.Exit(2);
        }

        using var pushfy = new PushfyClient(new PushfyClientOptions { ApiToken = token });

        var mp3 = File.ReadAllBytes(audioPath);

        try
        {
            var uploaded = await pushfy.UploadAudioAsync("welcome", mp3, "welcome.mp3");
            Console.WriteLine("Uploaded: " + uploaded);

            var audioId = ExtractAudioId(uploaded);
            if (audioId == null)
            {
                Console.Error.WriteLine("Could not read the audio id from: " + uploaded);
                Environment.Exit(1);
            }

            var result = await pushfy.SendVoiceAsync("5511999999999", audioId: audioId!, extId: "call-1042");
            Console.WriteLine("Call queued: " + result);
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

    // The upload response is a JsonElement; pull out the audio id defensively.
    private static string? ExtractAudioId(JsonElement uploaded)
    {
        if (uploaded.ValueKind != JsonValueKind.Object) return null;
        if (uploaded.TryGetProperty("id", out var id)) return id.ToString();
        if (uploaded.TryGetProperty("audio", out var audio)) return audio.ToString();
        return null;
    }
}
