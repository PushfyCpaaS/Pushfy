import com.pushfy.ApiException;
import com.pushfy.Pushfy;
import com.pushfy.RateLimitException;

import java.util.ArrayList;
import java.util.List;

/**
 * Send a large audience by splitting it into chunks and calling
 * {@link Pushfy#sendBulkSms(List)} once per chunk.
 *
 * <p>Chunking keeps each request within API limits and lets you pace the
 * traffic. A per-recipient ext_id keeps every message individually trackable.
 */
public class BatchSend {

    private static final int CHUNK_SIZE = 500;

    public static void main(String[] args) throws InterruptedException {
        String token = System.getenv("PUSHFY_API_TOKEN");
        Pushfy pushfy = Pushfy.builder()
                .apiToken(token)
                .build();

        // Build a demo audience. In production this comes from your database.
        List<Pushfy.Sms> audience = new ArrayList<>();
        for (int i = 0; i < 1200; i++) {
            audience.add(new Pushfy.Sms(
                    "5511999999999",
                    "Batch message #" + i,
                    "batch-" + i));
        }

        List<List<Pushfy.Sms>> chunks = chunk(audience, CHUNK_SIZE);
        System.out.println("Sending " + audience.size() + " messages in " + chunks.size() + " chunks");

        int sent = 0;
        for (int c = 0; c < chunks.size(); c++) {
            List<Pushfy.Sms> batch = chunks.get(c);
            try {
                pushfy.sendBulkSms(batch);
                sent += batch.size();
                System.out.println("Chunk " + (c + 1) + "/" + chunks.size()
                        + " accepted (" + batch.size() + " msgs)");
            } catch (RateLimitException err) {
                long delay = err.retryAfter != null ? err.retryAfter * 1000L : 2000L;
                System.err.println("Chunk " + (c + 1) + " rate limited; pausing " + delay + "ms and retrying");
                Thread.sleep(delay);
                pushfy.sendBulkSms(batch); // retry once; extIds keep it idempotent
                sent += batch.size();
            } catch (ApiException err) {
                System.err.println("Chunk " + (c + 1) + " failed (" + err.status
                        + "): " + err.getMessage());
            }

            // Gentle pacing between chunks.
            Thread.sleep(200);
        }

        System.out.println("Done. Accepted " + sent + "/" + audience.size() + " messages.");
    }

    /** Split a list into consecutive sublists of at most {@code size} elements. */
    private static <T> List<List<T>> chunk(List<T> items, int size) {
        List<List<T>> out = new ArrayList<>();
        for (int i = 0; i < items.size(); i += size) {
            out.add(new ArrayList<>(items.subList(i, Math.min(i + size, items.size()))));
        }
        return out;
    }
}
