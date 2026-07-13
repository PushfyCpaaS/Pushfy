# Pushfy SDK for Java

Official Java client for the [Pushfy API](https://github.com/PushfyCpaaS/Pushfy) —
SMS, RCS, Voice, Push Notifications and Conversational AI.

- Requires **Java 11+** (uses the built-in `java.net.http.HttpClient`).
- **Zero runtime dependencies** — HMAC via `javax.crypto.Mac`, JSON via a tiny internal codec.

## Installation

Maven:

```xml
<dependency>
  <groupId>com.pushfy</groupId>
  <artifactId>pushfy</artifactId>
  <version>1.0.0</version>
</dependency>
```

Gradle:

```groovy
implementation 'com.pushfy:pushfy:1.0.0'
```

## Quick start

```java
import com.pushfy.Pushfy;

Pushfy pushfy = Pushfy.builder()
        .apiToken("YOUR_API_TOKEN")
        .build();

Object result = pushfy.sendSms("5511999999999", "Hello from Pushfy", "welcome-001");
System.out.println(result); // [{id, phone, date, ext_id}]
```

Responses are returned as parsed JSON — a `java.util.Map`, `java.util.List`,
`String`, `Number` (`Long`/`Double`), `Boolean` or `null`. The one exception is
`getBalance()`, which returns a typed `Pushfy.Balance`.

## Authentication

Different products use different credentials — set whatever you need on the builder:

```java
Pushfy pushfy = Pushfy.builder()
        .apiToken("YOUR_API_TOKEN")   // Messaging (SMS/RCS/Voice, status, balance) — Bearer
        .paKey("pak_...")             // Conversational AI (HMAC)
        .paSecret("pas_...")
        .pushKey("pushk_...")         // Push server API (HMAC)
        .pushSecret("pss_...")
        .appId("pushapp_...")         // Public Push app id
        .build();
```

HMAC signing for the V2 (Push / Conversational) endpoints is handled automatically:
the client signs `timestamp\nMETHOD\nroute\nsha256hex(body)` and sends `X-PA-*` (AI)
or `X-PUSH-*` (Push) headers. Public Push endpoints inject `app_id` into the body.

## Usage

### SMS

```java
pushfy.sendSms("5511999999999", "Hi", "ref-1");

pushfy.sendBulkSms(java.util.List.of(
        new Pushfy.Sms("5511999990001", "Hi Ana",   "b1"),
        new Pushfy.Sms("5511999990002", "Hi Bruno", "b2")));
```

### RCS

```java
Pushfy.Rcs card = new Pushfy.Rcs();
card.to    = "5511999999999";
card.title = "Order shipped";
card.text  = "Your order #1042 is on the way";
card.image = "https://cdn.example.com/box.jpg";
card.url   = "https://example.com/track/1042";
card.cta   = "Track order";
pushfy.sendRcs(card);
```

### Voice

Voice is two steps: upload the mp3 with a name, then place the call by that
same name. The upload response does not return an audio id — keep the name
you chose and pass it as `audioName`.

```java
byte[] mp3 = java.nio.file.Files.readAllBytes(java.nio.file.Path.of("welcome.mp3"));
pushfy.uploadAudio("Welcome message", mp3, "welcome.mp3");
pushfy.sendVoice("5511999999999", "Welcome message", "call-1");
```

### Delivery status, report & balance

```java
pushfy.messageStatus("ref-1", null);   // by ext_id
pushfy.messagesByDate("2026-07-01");   // whole day

Pushfy.ReportQuery q = new Pushfy.ReportQuery();
q.start = "2026-07-01 00:00:00";
q.end   = "2026-07-01 23:59:59";
pushfy.report(q);

Pushfy.Balance b = pushfy.getBalance();  // { raw: "1.500", balance: 1500 }
System.out.println(b.balance);
```

### Push Notifications (server)

```java
java.util.Map<String, Object> body = new java.util.LinkedHashMap<>();
body.put("name", "Promo");
body.put("title", "Sale!");
body.put("body", "50% off");
body.put("url", "https://example.com");

Object campaign = pushfy.push.campaigns.create(body);
Object id = ((java.util.Map<?, ?>) campaign).get("id");
pushfy.push.campaigns.send(id);
pushfy.push.campaigns.metrics(id);
```

Also available: `pushfy.push.devices.list/register/remove`,
`pushfy.push.segments.list/create`, `pushfy.push.test(...)`, and the public
`pushfy.push.subscribe(...)` / `pushfy.push.track(...)` (which inject `app_id`).

### Conversational AI

```java
Object conv = pushfy.openConversation("user-42", "Ana", null);
Object convId = ((java.util.Map<?, ?>) conv).get("conversation_id");

pushfy.postMessage(convId, "I need help with a withdrawal");
pushfy.getConversation(convId);   // the bot replies asynchronously
pushfy.handoff(convId);           // escalate to a human
pushfy.closeConversation(convId);

pushfy.sendEvent("deposit", "user-42", java.util.Map.of("amount", 100));
pushfy.scheduleTask(convId, "2026-07-14 09:00:00", "Follow up on the withdrawal");
```

## Error handling

Every failure throws a `PushfyException` subclass (all unchecked). Branch on the type:

```java
import com.pushfy.*;

try {
    pushfy.sendSms("5511999999999", "Hi");
} catch (RateLimitException e) {
    // 429 — back off and retry; e.retryAfter is seconds when known
} catch (AuthenticationException e) {
    // 401/403 — check your token / HMAC credentials
} catch (InvalidRequestException e) {
    // 400/413/415 — the request was malformed
} catch (ApiException e) {
    // 5xx / network / timeout — safe to retry idempotently (reuse the same extId)
} catch (PushfyException e) {
    System.err.println(e.status + " " + e.code + " " + e.response);
}
```

> **Never blindly resend after a send timeout** — you may double-charge. Query the
> status by `extId` first.

## Verifying webhooks

Always verify against the **raw** request body bytes — re-serializing changes the
signature. Comparison is constant-time (`MessageDigest.isEqual`).

```java
import com.pushfy.Webhooks;

boolean ok = Webhooks.messaging(rawBody, request.getHeader("X-Pushfy-Signature"), webhookSecret);
if (!ok) {
    // reject with 401
}
```

Helpers per product:

| Product              | Header               | Scheme      | Method                       |
|----------------------|----------------------|-------------|------------------------------|
| Messaging status/DLR | `X-Pushfy-Signature` | `sha256=` … | `Webhooks.messaging(...)`    |
| Push Notifications   | `X-Push-Signature`   | `sha256=` … | `Webhooks.push(...)`         |
| Conversational AI    | `X-PA-Signature`     | raw hex     | `Webhooks.conversations(...)`|

Each helper accepts either a `String` or `byte[]` payload.

## Building & testing

```bash
mvn package          # builds target/pushfy-1.0.0.jar

# Offline smoke test (no network, no test framework required):
javac -d out $(find src/main/java -name '*.java') src/test/java/com/pushfy/SmokeTest.java
java  -cp out com.pushfy.SmokeTest
```

## License

MIT © Pushfy
