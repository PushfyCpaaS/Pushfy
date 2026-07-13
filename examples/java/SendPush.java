import com.pushfy.ApiException;
import com.pushfy.AuthenticationException;
import com.pushfy.Pushfy;
import com.pushfy.RateLimitException;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Create and send a Push Notifications campaign through the server API.
 *
 * <p>The Push server endpoints are HMAC-signed, so this needs {@code pushKey} /
 * {@code pushSecret} rather than the messaging Bearer token. Set:
 * <pre>
 *   export PUSHFY_PUSH_KEY=pushk_...
 *   export PUSHFY_PUSH_SECRET=pss_...
 * </pre>
 */
public class SendPush {

    public static void main(String[] args) {
        String pushKey = System.getenv("PUSHFY_PUSH_KEY");
        String pushSecret = System.getenv("PUSHFY_PUSH_SECRET");
        if (pushKey == null || pushSecret == null) {
            System.err.println("Set PUSHFY_PUSH_KEY and PUSHFY_PUSH_SECRET in your environment.");
            System.exit(2);
        }

        Pushfy pushfy = Pushfy.builder()
                .pushKey(pushKey)
                .pushSecret(pushSecret)
                .build();

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("name", "Promo July");
        body.put("title", "Sale!");
        body.put("body", "50% off today only");
        body.put("url", "https://example.com/sale");

        try {
            Object campaign = pushfy.push.campaigns.create(body);
            Object id = ((Map<?, ?>) campaign).get("id");
            System.out.println("Created campaign " + id);

            pushfy.push.campaigns.send(id);
            System.out.println("Campaign " + id + " sent.");

            Object metrics = pushfy.push.campaigns.metrics(id);
            System.out.println("Metrics: " + metrics);
        } catch (RateLimitException err) {
            System.err.println("Rate limited. Retry after " + err.retryAfter + "s.");
            System.exit(1);
        } catch (AuthenticationException err) {
            System.err.println("Auth failed (" + err.status + "). Check push key/secret.");
            System.exit(1);
        } catch (ApiException err) {
            System.err.println("Transient failure: " + err.status + " " + err.getMessage());
            System.exit(1);
        }
    }
}
