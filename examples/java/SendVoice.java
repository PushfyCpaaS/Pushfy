import com.pushfy.ApiException;
import com.pushfy.Pushfy;
import com.pushfy.RateLimitException;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

/**
 * Place a voice call: upload an .mp3, then dial a number referencing it.
 *
 * <p>{@link Pushfy#uploadAudio(String, byte[], String)} returns the stored audio
 * descriptor; we read its {@code id} and pass it to
 * {@link Pushfy#sendVoice(String, String, String)}.
 *
 * <pre>
 *   export PUSHFY_API_TOKEN=...
 *   export AUDIO_PATH=./welcome.mp3
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

        Pushfy pushfy = Pushfy.builder()
                .apiToken(token)
                .build();

        byte[] mp3 = Files.readAllBytes(Path.of(audioPath));

        try {
            Object uploaded = pushfy.uploadAudio("welcome", mp3, "welcome.mp3");
            System.out.println("Uploaded: " + uploaded);

            String audioId = extractAudioId(uploaded);
            if (audioId == null) {
                System.err.println("Could not read the audio id from: " + uploaded);
                System.exit(1);
            }

            Object result = pushfy.sendVoice("5511999999999", audioId, "call-1042");
            System.out.println("Call queued: " + result);
        } catch (RateLimitException err) {
            System.err.println("Rate limited. Retry after " + err.retryAfter + "s.");
            System.exit(1);
        } catch (ApiException err) {
            System.err.println("Transient failure: " + err.status + " " + err.getMessage());
            System.exit(1);
        }
    }

    /** The upload response is parsed JSON; pull out the audio id defensively. */
    private static String extractAudioId(Object uploaded) {
        if (uploaded instanceof Map) {
            Object id = ((Map<?, ?>) uploaded).get("id");
            if (id == null) {
                id = ((Map<?, ?>) uploaded).get("audio");
            }
            return id != null ? String.valueOf(id) : null;
        }
        return null;
    }
}
