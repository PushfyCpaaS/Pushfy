using System;
using System.IO;
using System.Threading.Tasks;
using Pushfy;

// Place a voice call: upload an .mp3 under a name, then dial a number referencing it.
// The upload does NOT return an audio id — the audio is identified by the name you
// choose. Pass that same name when placing the call.
//   export PUSHFY_API_TOKEN=...
//   export AUDIO_PATH=./welcome.mp3
//   export AUDIO_NAME="Welcome message"   # optional, this is the default
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

        // The name identifies the audio on both steps. Keep upload and call in sync.
        var audioName = Environment.GetEnvironmentVariable("AUDIO_NAME") ?? "Welcome message";

        using var pushfy = new PushfyClient(new PushfyClientOptions { ApiToken = token });

        var mp3 = File.ReadAllBytes(audioPath);

        try
        {
            await pushfy.UploadAudioAsync(audioName, mp3, "welcome.mp3");
            Console.WriteLine("Uploaded audio: " + audioName);

            var result = await pushfy.SendVoiceAsync("5511999999999", audioName: audioName, extId: "call-1042");
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
}
