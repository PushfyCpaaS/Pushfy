import com.pushfy.Webhooks;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;

/**
 * A minimal HTTP endpoint that receives Pushfy messaging (status/DLR) webhooks
 * and verifies their signature before trusting the payload.
 *
 * <p>Key rule: verify against the RAW request-body bytes. Re-serializing the
 * JSON would change the signature and every request would look invalid.
 *
 * <pre>
 *   export PUSHFY_WEBHOOK_SECRET=...
 *   java -cp pushfy-1.0.0.jar:out ReceiveWebhook
 *   # POST http://localhost:8080/webhooks/pushfy  with X-Pushfy-Signature: sha256=<hex>
 * </pre>
 */
public class ReceiveWebhook {

    public static void main(String[] args) throws Exception {
        String secret = System.getenv("PUSHFY_WEBHOOK_SECRET");
        if (secret == null || secret.isEmpty()) {
            System.err.println("Set PUSHFY_WEBHOOK_SECRET in your environment.");
            System.exit(2);
        }

        int port = 8080;
        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
        server.createContext("/webhooks/pushfy", exchange -> handle(exchange, secret));
        server.setExecutor(null); // default executor
        server.start();
        System.out.println("Listening on http://localhost:" + port + "/webhooks/pushfy");
    }

    private static void handle(HttpExchange exchange, String secret) {
        try {
            if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                respond(exchange, 405, "Method Not Allowed");
                return;
            }

            // Read the exact bytes received — do not parse-then-reserialize.
            byte[] rawBody;
            try (InputStream in = exchange.getRequestBody()) {
                rawBody = in.readAllBytes();
            }

            String signature = exchange.getRequestHeaders().getFirst("X-Pushfy-Signature");

            boolean ok = Webhooks.messaging(rawBody, signature, secret);
            if (!ok) {
                respond(exchange, 401, "Invalid signature");
                return;
            }

            // Signature is valid — safe to process the payload now.
            String payload = new String(rawBody, StandardCharsets.UTF_8);
            System.out.println("Verified webhook: " + payload);

            respond(exchange, 200, "OK");
        } catch (Exception e) {
            System.err.println("Webhook error: " + e.getMessage());
            respond(exchange, 500, "Internal Error");
        }
    }

    private static void respond(HttpExchange exchange, int status, String message) {
        try {
            byte[] out = message.getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(status, out.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(out);
            }
        } catch (Exception ignored) {
            // best-effort response
        }
    }
}
