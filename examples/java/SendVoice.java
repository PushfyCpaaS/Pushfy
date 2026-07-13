import com.pushfy.ApiException;
import com.pushfy.Pushfy;
import com.pushfy.RateLimitException;

import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Place a voice call: upload an .mp3 under a name, then dial a number referencing it.
 *
 * <p>The upload does <em>not</em> return an audio id — the audio is identified by the
 * name you choose. Pass that same name to {@link Pushfy#sendVoice(String, String, String)}.
 *
 * <pre>
 *   export PUSHFY_API_TOKEN=...
 *   export AUDIO_PATH=./welcome.mp3
 *   export AUDIO_NAME="Welcome message"   # optional, this is the default
 * </pre>
 */
public class SendVoice {

    public static void main(String[] args) throws Exception {
        String token = System.getenv("PUSHFY_API_TOKEN");
        String audioPath = System.getenv("AUDIO_PATH");
        if (token == null || audioPath == null) {
            System.err.println("Set PUSHFY_API_TOKEN and AUDIO_PATH in your environment.");
            System.exit(2);
        }

        // The name identifies the audio on both steps. Keep upload and call in sync.
        String audioName = System.getenv("AUDIO_NAME");
        if (audioName == null) {
            audioName = "Welcome message";
        }

        Pushfy pushfy = Pushfy.builder()
                .apiToken(token)
                .build();

        byte[] mp3 = Files.readAllBytes(Path.of(audioPath));

        try {
            pushfy.uploadAudio(audioName, mp3, "welcome.mp3");
            System.out.println("Uploaded audio: " + audioName);

            Object result = pushfy.sendVoice("5511999999999", audioName, "call-1042");
            System.out.println("Call queued: " + result);
        } catch (RateLimitException err) {
            System.err.println("Rate limited. Retry after " + err.retryAfter + "s.");
            System.exit(1);
        } catch (ApiException err) {
            System.err.println("Transient failure: " + err.status + " " + err.getMessage());
            System.exit(1);
        }
    }
}
