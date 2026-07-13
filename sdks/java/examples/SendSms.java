import com.pushfy.ApiException;
import com.pushfy.Pushfy;
import com.pushfy.RateLimitException;

/**
 * Send an SMS with the Pushfy Java SDK.
 *
 * <p>Compile against the built jar (or the compiled classes) and run with
 * {@code PUSHFY_API_TOKEN} in your environment:
 *
 * <pre>
 *   javac -cp target/pushfy-1.0.0.jar examples/SendSms.java -d out-examples
 *   java  -cp target/pushfy-1.0.0.jar:out-examples SendSms
 * </pre>
 */
public class SendSms {

    public static void main(String[] args) {
        String token = System.getenv("PUSHFY_API_TOKEN");
        Pushfy pushfy = Pushfy.builder().apiToken(token).build();

        try {
            Object result = pushfy.sendSms(
                    "5511999999999",
                    "Hello from the Pushfy Java SDK",
                    "demo-" + System.currentTimeMillis());
            System.out.println("Accepted: " + result);
        } catch (RateLimitException err) {
            System.err.println("Rate limited — back off and retry.");
            System.exit(1);
        } catch (ApiException err) {
            // 5xx / network — safe to retry idempotently (reuse the same extId).
            System.err.println("Transient failure: " + err.status + " " + err.getMessage());
            System.exit(1);
        } catch (Exception err) {
            System.err.println("Failed: " + err.getMessage());
            System.exit(1);
        }
    }
}
