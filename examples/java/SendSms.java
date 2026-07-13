import com.pushfy.ApiException;
import com.pushfy.AuthenticationException;
import com.pushfy.Pushfy;
import com.pushfy.RateLimitException;

/**
 * Send a single SMS with the Pushfy Java SDK.
 *
 * <p>Run with the Bearer token in your environment:
 * <pre>
 *   export PUSHFY_API_TOKEN=...
 *   javac -cp pushfy-1.0.0.jar SendSms.java -d out
 *   java  -cp pushfy-1.0.0.jar:out SendSms
 * </pre>
 */
public class SendSms {

    public static void main(String[] args) {
        String token = System.getenv("PUSHFY_API_TOKEN");
        if (token == null || token.isEmpty()) {
            System.err.println("Set PUSHFY_API_TOKEN in your environment.");
            System.exit(2);
        }

        Pushfy pushfy = Pushfy.builder()
                .apiToken(token)
                .build();

        // A stable ext_id lets you look up the delivery status later and makes a
        // retry idempotent (the same id is never charged twice).
        String extId = "welcome-" + System.currentTimeMillis();

        try {
            Object result = pushfy.sendSms(
                    "5511999999999",
                    "Hello from the Pushfy Java SDK",
                    extId);
            System.out.println("Accepted: " + result);

            // Query the delivery status by the ext_id we chose above.
            Object status = pushfy.messageStatus(extId, null);
            System.out.println("Status: " + status);
        } catch (RateLimitException err) {
            System.err.println("Rate limited. Retry after " + err.retryAfter + "s.");
            System.exit(1);
        } catch (AuthenticationException err) {
            System.err.println("Auth failed (" + err.status + "). Check PUSHFY_API_TOKEN.");
            System.exit(1);
        } catch (ApiException err) {
            // 5xx / network / timeout: safe to retry idempotently reusing extId.
            System.err.println("Transient failure: " + err.status + " " + err.getMessage());
            System.exit(1);
        }
    }
}
