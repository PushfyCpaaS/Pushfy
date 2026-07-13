import com.pushfy.ApiException;
import com.pushfy.Pushfy;
import com.pushfy.RateLimitException;

import java.util.List;

/**
 * Send several SMS in a single request with {@link Pushfy#sendBulkSms(List)}.
 *
 * <p>Each {@link Pushfy.Sms} carries its own text and ext_id, so one API call
 * fans out to many recipients. For very large audiences chunk the list first
 * (see BatchSend.java).
 */
public class SendBulkSms {

    public static void main(String[] args) {
        String token = System.getenv("PUSHFY_API_TOKEN");
        if (token == null || token.isEmpty()) {
            System.err.println("Set PUSHFY_API_TOKEN in your environment.");
            System.exit(2);
        }

        Pushfy pushfy = Pushfy.builder()
                .apiToken(token)
                .build();

        List<Pushfy.Sms> messages = List.of(
                new Pushfy.Sms("5511999999999", "Hi Ana, your code is 1234",   "bulk-ana"),
                new Pushfy.Sms("5511999999999", "Hi Bruno, your code is 5678", "bulk-bruno"),
                new Pushfy.Sms("5511999999999", "Hi Carla, your code is 9012", "bulk-carla"));

        try {
            Object result = pushfy.sendBulkSms(messages);
            System.out.println("Accepted " + messages.size() + " messages: " + result);
        } catch (RateLimitException err) {
            System.err.println("Rate limited. Retry after " + err.retryAfter + "s.");
            System.exit(1);
        } catch (ApiException err) {
            System.err.println("Transient failure: " + err.status + " " + err.getMessage());
            System.exit(1);
        }
    }
}
