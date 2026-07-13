package com.pushfy;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Offline smoke test — validates HMAC signing, webhook verification, balance
 * parsing and request shaping without hitting the network.
 *
 * <p>Runs with a bare JDK (no test framework required):
 * <pre>
 *   javac -d out $(find src/main/java -name '*.java') src/test/java/com/pushfy/SmokeTest.java
 *   java  -cp out com.pushfy.SmokeTest
 * </pre>
 */
public final class SmokeTest {

    private static int passed = 0;

    public static void main(String[] args) {
        // 1. HMAC signing matches the documented recipe exactly:
        //    base = ts\nMETHOD\nroute\nsha256hex(body)
        {
            long ts = 1752345600L;
            String body = "{\"user_ext_id\":\"user-42\"}";
            String secret = "pas_test";
            Hmac.Signed signed = Hmac.sign("post", "/v1/conversations", body, secret, ts);
            String bh = Hmac.sha256Hex(body);
            String base = ts + "\nPOST\n/v1/conversations\n" + bh;
            String expected = Hmac.hmacSha256Hex(base, secret);
            assertEq(expected, signed.signature, "HMAC signature matches canonical base string");
            assertEq(String.valueOf(ts), signed.timestamp, "HMAC preserves the supplied timestamp");
        }

        // 2. Known SHA-256 vector for the empty string (guards the hex/digest path).
        {
            assertEq("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
                    Hmac.sha256Hex(""), "sha256(\"\") matches the known vector");
        }

        // 3. Webhook verification: raw (X-PA) vs prefixed (X-Push/X-Pushfy) schemes.
        {
            String secret = "WEBHOOK_SECRET";
            String payload = "{\"eid\":\"evt_1\",\"event\":\"handoff.requested\"}";
            String hex = Hmac.hmacSha256Hex(payload, secret);
            assertTrue(Webhooks.conversations(payload, hex, secret),
                    "conversations() accepts raw hex signature");
            assertTrue(Webhooks.push(payload, "sha256=" + hex, secret),
                    "push() accepts sha256= prefixed signature");
            assertTrue(Webhooks.messaging(payload, "sha256=" + hex, secret),
                    "messaging() accepts sha256= prefixed signature");
            assertFalse(Webhooks.push(payload, hex, secret),
                    "push() requires the sha256= prefix");
            assertFalse(Webhooks.conversations(payload, "sha256=" + hex, secret),
                    "conversations() rejects the sha256= prefix (raw scheme)");
            assertFalse(Webhooks.conversations(payload, "deadbeef", secret),
                    "conversations() rejects a bogus signature");
            assertFalse(Webhooks.messaging(payload, null, secret),
                    "verify() rejects a null signature");
        }

        // 4. balance.get parses the formatted string {"saldo":"1.500"} -> 1500.
        {
            Map<String, Object> res = new LinkedHashMap<>();
            res.put("saldo", "1.500");
            Pushfy.Balance b = Pushfy.balanceFrom(res);
            assertEq("1.500", b.raw, "balance keeps the raw string");
            assertTrue(b.balance != null && b.balance == 1500L, "balance parses \"1.500\" -> 1500");
        }

        // 5. Phone normalization strips non-digits (matches the Node SDK).
        {
            assertEq("5511999999999", Pushfy.digits("+55 (11) 99999-9999"),
                    "digits() normalizes a formatted phone number");
        }

        // 6. toMessage shapes the /webapi message body correctly.
        {
            Map<String, Object> m = Pushfy.toMessage("+55 (11) 99999-9999", "Hi", "x", null);
            Object dests = m.get("destinations");
            assertTrue(dests instanceof List, "destinations is a list");
            @SuppressWarnings("unchecked")
            Map<String, Object> d0 = (Map<String, Object>) ((List<Object>) dests).get(0);
            assertEq("5511999999999", String.valueOf(d0.get("to")), "message phone normalized");
            assertEq("Hi", String.valueOf(m.get("text")), "message text preserved");
            assertEq("x", String.valueOf(m.get("ext_id")), "message ext_id preserved");
        }

        // 7. JSON round-trips the request/response shapes we rely on.
        {
            Map<String, Object> obj = new LinkedHashMap<>();
            obj.put("s", "a\"b\\c\n");
            obj.put("n", 1500L);
            obj.put("b", Boolean.TRUE);
            obj.put("nil", null);
            List<Object> arr = new ArrayList<>();
            arr.add("x");
            arr.add(42L);
            obj.put("arr", arr);
            String enc = Json.encode(obj);
            Object back = Json.parse(enc);
            assertTrue(back instanceof Map, "parsed JSON is an object");
            @SuppressWarnings("unchecked")
            Map<String, Object> pm = (Map<String, Object>) back;
            assertEq("a\"b\\c\n", String.valueOf(pm.get("s")), "JSON string escapes round-trip");
            assertTrue(pm.get("n") instanceof Long && (Long) pm.get("n") == 1500L,
                    "JSON integer round-trips as Long");
            assertTrue(Boolean.TRUE.equals(pm.get("b")), "JSON boolean round-trips");
            assertTrue(pm.containsKey("nil") && pm.get("nil") == null, "JSON null round-trips");
            assertEq("[\"x\",42]", Json.encode(pm.get("arr")), "JSON array round-trips");
        }

        // 8. Array response parsing (e.g. sms.send result).
        {
            Object parsed = Json.parse("[{\"id\":\"x\",\"ext_id\":\"x\"}]");
            assertTrue(parsed instanceof List, "top-level array parses to a List");
        }

        System.out.println();
        System.out.println(passed + " checks passed.");
    }

    private static void assertEq(String expected, String actual, String name) {
        if (expected == null ? actual == null : expected.equals(actual)) {
            ok(name);
        } else {
            fail(name + " (expected=" + expected + " actual=" + actual + ")");
        }
    }

    private static void assertTrue(boolean cond, String name) {
        if (cond) {
            ok(name);
        } else {
            fail(name);
        }
    }

    private static void assertFalse(boolean cond, String name) {
        assertTrue(!cond, name);
    }

    private static void ok(String name) {
        System.out.println("  [ok] " + name);
        passed++;
    }

    private static void fail(String name) {
        System.out.println("  [FAIL] " + name);
        throw new AssertionError("SMOKE TEST FAILED: " + name);
    }
}
