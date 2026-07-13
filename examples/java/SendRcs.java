import com.pushfy.ApiException;
import com.pushfy.InvalidRequestException;
import com.pushfy.Pushfy;
import com.pushfy.RateLimitException;

/**
 * Send an RCS rich card with {@link Pushfy#sendRcs(Pushfy.Rcs)}.
 *
 * <p>Only {@code to} and {@code text} are required; title, image, url and cta
 * are optional and turn a plain message into a rich card with a tappable button.
 */
public class SendRcs {

    public static void main(String[] args) {
        String token = System.getenv("PUSHFY_API_TOKEN");
        if (token == null || token.isEmpty()) {
            System.err.println("Set PUSHFY_API_TOKEN in your environment.");
            System.exit(2);
        }

        Pushfy pushfy = Pushfy.builder()
                .apiToken(token)
                .build();

        Pushfy.Rcs card = new Pushfy.Rcs();
        card.to    = "5511999999999";
        card.title = "Order shipped";
        card.text  = "Your order #1042 is on the way";
        card.image = "https://cdn.example.com/box.jpg";
        card.url   = "https://example.com/track/1042";
        card.cta   = "Track order";
        card.extId = "rcs-order-1042";

        try {
            Object result = pushfy.sendRcs(card);
            System.out.println("Accepted: " + result);
        } catch (RateLimitException err) {
            System.err.println("Rate limited. Retry after " + err.retryAfter + "s.");
            System.exit(1);
        } catch (InvalidRequestException err) {
            System.err.println("Malformed RCS card: " + err.getMessage());
            System.exit(1);
        } catch (ApiException err) {
            System.err.println("Transient failure: " + err.status + " " + err.getMessage());
            System.exit(1);
        }
    }
}
