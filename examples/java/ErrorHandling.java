import com.pushfy.ApiException;
import com.pushfy.AuthenticationException;
import com.pushfy.InvalidRequestException;
import com.pushfy.Pushfy;
import com.pushfy.PushfyException;
import com.pushfy.RateLimitException;

/**
 * Branch on the typed Pushfy exceptions. Every failure throws a
 * {@link PushfyException} subclass (all unchecked); catch the specific ones
 * first, then fall through to the base.
 *
 * <p>Hierarchy: {@code PushfyException} is the base of
 * {@code AuthenticationException}, {@code InvalidRequestException},
 * {@code RateLimitException} and {@code ApiException}.
 */
public class ErrorHandling {

    public static void main(String[] args) {
        String token = System.getenv("PUSHFY_API_TOKEN");
        Pushfy pushfy = Pushfy.builder()
                .apiToken(token)
                .build();

        try {
            Object result = pushfy.sendSms("5511999999999", "Hi", "err-demo-1");
            System.out.println("Accepted: " + result);
        } catch (RateLimitException err) {
            // 429 — back off and retry; retryAfter is seconds when the server told us.
            System.err.println("Rate limited. retryAfter=" + err.retryAfter + "s");
        } catch (AuthenticationException err) {
            // 401/403 — bad token or HMAC credentials.
            System.err.println("Auth error (" + err.status + "): check your credentials");
        } catch (InvalidRequestException err) {
            // 400/413/415 — the request was malformed; do NOT retry unchanged.
            System.err.println("Invalid request (" + err.status + "): " + err.code);
        } catch (ApiException err) {
            // 5xx / network / timeout — safe to retry idempotently (reuse the extId).
            System.err.println("Transient error (" + err.status + "): retry later");
        } catch (PushfyException err) {
            // Anything else the SDK surfaces.
            System.err.println("Pushfy error: " + err.status + " " + err.code + " " + err.response);
        }
    }
}
