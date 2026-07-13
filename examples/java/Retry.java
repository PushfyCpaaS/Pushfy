import com.pushfy.ApiException;
import com.pushfy.Pushfy;
import com.pushfy.PushfyException;
import com.pushfy.RateLimitException;

/**
 * Retry a send with exponential backoff, idempotently.
 *
 * <p>The golden rule: never blindly resend after a timeout — you may double
 * charge. Instead reuse the SAME {@code extId} on every attempt so the API can
 * de-duplicate, and only retry the retryable errors ({@link RateLimitException}
 * and {@link ApiException}). A malformed request (4xx) is not retried.
 */
public class Retry {

    private static final int MAX_ATTEMPTS = 5;
    private static final long BASE_DELAY_MS = 500;

    public static void main(String[] args) throws InterruptedException {
        String token = System.getenv("PUSHFY_API_TOKEN");
        Pushfy pushfy = Pushfy.builder()
                .apiToken(token)
                .build();

        // A single, stable ext_id shared across all attempts keeps the send idempotent.
        String extId = "retry-" + System.currentTimeMillis();

        Object result = sendWithRetry(pushfy, "5511999999999", "Hello (with retry)", extId);
        if (result != null) {
            System.out.println("Accepted after retry: " + result);
        } else {
            System.err.println("Giving up after " + MAX_ATTEMPTS + " attempts.");
            System.exit(1);
        }
    }

    private static Object sendWithRetry(Pushfy pushfy, String to, String text, String extId)
            throws InterruptedException {
        for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
                return pushfy.sendSms(to, text, extId);
            } catch (RateLimitException err) {
                // Honour the server's Retry-After when present, else back off.
                long delay = err.retryAfter != null
                        ? err.retryAfter * 1000L
                        : backoff(attempt);
                System.err.println("Attempt " + attempt + " rate limited; waiting " + delay + "ms");
                if (attempt == MAX_ATTEMPTS) {
                    return null;
                }
                Thread.sleep(delay);
            } catch (ApiException err) {
                // 5xx / network / timeout — retryable because extId makes it idempotent.
                long delay = backoff(attempt);
                System.err.println("Attempt " + attempt + " failed (" + err.status
                        + "); waiting " + delay + "ms");
                if (attempt == MAX_ATTEMPTS) {
                    return null;
                }
                Thread.sleep(delay);
            } catch (PushfyException err) {
                // 4xx (auth / invalid request) — not retryable, fail fast.
                System.err.println("Non-retryable error: " + err.status + " " + err.code);
                return null;
            }
        }
        return null;
    }

    /** Exponential backoff with jitter: base * 2^(attempt-1) + [0, base). */
    private static long backoff(int attempt) {
        long exp = BASE_DELAY_MS * (1L << (attempt - 1));
        long jitter = (long) (Math.random() * BASE_DELAY_MS);
        return exp + jitter;
    }
}
