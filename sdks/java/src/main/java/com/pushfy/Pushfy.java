package com.pushfy;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Pushfy API client — SMS, RCS, Voice, Push Notifications and Conversational AI.
 *
 * <p>Three credential families feed three transports, exactly like the Node SDK:
 * <ul>
 *   <li>Messaging (classic): Bearer token against {@code https://portal.pushfy.com/<path>}.</li>
 *   <li>V2 (Push server / Conversational AI): HMAC-signed against
 *       {@code https://portal.pushfy.com/v2/api.php?r=<route>} with
 *       {@code X-PUSH-*} / {@code X-PA-*} headers.</li>
 *   <li>Public Push: {@code app_id} injected into the body (no signing).</li>
 * </ul>
 *
 * <pre>
 *   Pushfy pushfy = Pushfy.builder().apiToken("YOUR_API_TOKEN").build();
 *   Object result = pushfy.sendSms("5511999999999", "Hello", "welcome-001");
 * </pre>
 *
 * <p>Every call returns the parsed JSON response as a plain {@link Object}
 * ({@link Map}, {@link List}, {@link String}, {@link Number}, {@link Boolean} or
 * {@code null}), except {@link #getBalance()} which returns a typed {@link Balance}.
 * Failures throw a {@link PushfyException} subclass.
 */
public class Pushfy {

    static final String DEFAULT_BASE = "https://portal.pushfy.com";
    static final String DEFAULT_V2_PATH = "/v2/api.php";

    final String apiToken;
    final String paKey;
    final String paSecret;
    final String pushKey;
    final String pushSecret;
    final String appId;
    final String baseUrl;
    final String v2Path;
    final long timeout;

    private final HttpClient httpClient;

    /** Push Notifications resource (server + public endpoints). */
    public final PushResource push;

    private Pushfy(Builder b) {
        this.apiToken = b.apiToken;
        this.paKey = b.paKey;
        this.paSecret = b.paSecret;
        this.pushKey = b.pushKey;
        this.pushSecret = b.pushSecret;
        this.appId = b.appId;
        String base = b.baseUrl != null ? b.baseUrl : DEFAULT_BASE;
        this.baseUrl = base.replaceAll("/+$", "");
        this.v2Path = b.v2Path != null ? b.v2Path : DEFAULT_V2_PATH;
        this.timeout = b.timeout;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofMillis(this.timeout))
                .build();
        this.push = new PushResource(this);
    }

    public static Builder builder() {
        return new Builder();
    }

    // =========================================================================
    // Config builder
    // =========================================================================

    /** Fluent configuration builder. Only set the credentials you actually use. */
    public static final class Builder {
        private String apiToken;
        private String paKey;
        private String paSecret;
        private String pushKey;
        private String pushSecret;
        private String appId;
        private String baseUrl = DEFAULT_BASE;
        private String v2Path = DEFAULT_V2_PATH;
        private long timeout = 30000L;

        /** Messaging Bearer token. */
        public Builder apiToken(String v) {
            this.apiToken = v;
            return this;
        }

        /** Conversational AI HMAC key (pak_...). */
        public Builder paKey(String v) {
            this.paKey = v;
            return this;
        }

        /** Conversational AI HMAC secret (pas_...). */
        public Builder paSecret(String v) {
            this.paSecret = v;
            return this;
        }

        /** Push server HMAC key (pushk_...). */
        public Builder pushKey(String v) {
            this.pushKey = v;
            return this;
        }

        /** Push server HMAC secret (pss_...). */
        public Builder pushSecret(String v) {
            this.pushSecret = v;
            return this;
        }

        /** Public Push app id (pushapp_...). */
        public Builder appId(String v) {
            this.appId = v;
            return this;
        }

        /** Override the base URL (defaults to https://portal.pushfy.com). */
        public Builder baseUrl(String v) {
            this.baseUrl = v;
            return this;
        }

        /** Override the V2 path (defaults to /v2/api.php). */
        public Builder v2Path(String v) {
            this.v2Path = v;
            return this;
        }

        /** Request timeout in milliseconds (default 30000). */
        public Builder timeout(long millis) {
            this.timeout = millis;
            return this;
        }

        public Pushfy build() {
            return new Pushfy(this);
        }
    }

    // =========================================================================
    // Messaging: SMS
    // =========================================================================

    /** Send a single SMS. Returns the API result array. */
    public Object sendSms(String to, String text, String extId) {
        Map<String, Object> json = new LinkedHashMap<>();
        List<Object> msgs = new ArrayList<>();
        msgs.add(toMessage(to, text, extId, null));
        json.put("messages", msgs);
        return classic("POST", "/webapi", json, null, null, null);
    }

    /** Send a single SMS without an ext_id. */
    public Object sendSms(String to, String text) {
        return sendSms(to, text, null);
    }

    /** Send many SMS in one request. */
    public Object sendBulkSms(List<Sms> messages) {
        List<Object> msgs = new ArrayList<>();
        for (Sms m : messages) {
            msgs.add(toMessage(m.to, m.text, m.extId, null));
        }
        Map<String, Object> json = new LinkedHashMap<>();
        json.put("messages", msgs);
        return classic("POST", "/webapi", json, null, null, null);
    }

    // =========================================================================
    // Messaging: RCS
    // =========================================================================

    /** Send an RCS rich card via the API RCS campaign. */
    public Object sendRcs(Rcs r) {
        Map<String, Object> msg = new LinkedHashMap<>();
        List<Object> dests = new ArrayList<>();
        Map<String, Object> dest = new LinkedHashMap<>();
        dest.put("to", digits(r.to));
        dests.add(dest);
        msg.put("destinations", dests);
        msg.put("text", r.text);
        if (r.title != null) {
            msg.put("title", r.title);
        }
        if (r.image != null) {
            msg.put("image", r.image);
        }
        if (r.url != null) {
            msg.put("url", r.url);
        }
        if (r.cta != null) {
            msg.put("cta", r.cta);
        }
        if (r.extId != null) {
            msg.put("ext_id", r.extId);
        }
        Map<String, Object> json = new LinkedHashMap<>();
        List<Object> msgs = new ArrayList<>();
        msgs.add(msg);
        json.put("messages", msgs);
        return classic("POST", "/apircsnativo.php", json, null, null, null);
    }

    // =========================================================================
    // Messaging: Voice
    // =========================================================================

    /**
     * Upload a voice audio (.mp3) as multipart/form-data. Returns the API result.
     *
     * @param name     label for the audio (falls back to the filename).
     * @param data     raw mp3 bytes.
     * @param filename filename, or {@code null} for "audio.mp3".
     */
    public Object uploadAudio(String name, byte[] data, String filename) {
        String fname = filename != null ? filename : "audio.mp3";
        String boundary = "----PushfyBoundary" + Long.toHexString(System.nanoTime());
        byte[] body = multipart(boundary, name != null ? name : fname, data, fname);
        return classic("POST", "/audio", null, body, "multipart/form-data; boundary=" + boundary, null);
    }

    /** Place a voice call by referencing a previously uploaded audio id. */
    public Object sendVoice(String to, String audioId, String extId) {
        Map<String, Object> json = new LinkedHashMap<>();
        List<Object> msgs = new ArrayList<>();
        msgs.add(toMessage(to, "", extId, audioId));
        json.put("messages", msgs);
        return classic("POST", "/webapi", json, null, null, null);
    }

    // =========================================================================
    // Messaging: status, report, balance
    // =========================================================================

    /** Delivery status of one message by your ext_id (or internal uid). */
    public Object messageStatus(String extId, String uid) {
        Map<String, Object> q = new LinkedHashMap<>();
        if (extId != null) {
            q.put("ext_id", extId);
        }
        if (uid != null) {
            q.put("uid", uid);
        }
        return classic("GET", "/getstatus", null, null, null, q);
    }

    /** Status of every message on a given day (YYYY-MM-DD). */
    public Object messagesByDate(String date) {
        Map<String, Object> q = new LinkedHashMap<>();
        if (date != null) {
            q.put("date", date);
        }
        return classic("GET", "/getdate", null, null, null, q);
    }

    /** Report by date range. */
    public Object report(ReportQuery r) {
        Map<String, Object> q = new LinkedHashMap<>();
        if (r.date != null) {
            q.put("date", r.date);
        }
        if (r.start != null) {
            q.put("start", r.start);
        }
        if (r.end != null) {
            q.put("end", r.end);
        }
        if (r.event != null) {
            q.put("event", r.event);
        }
        if (r.limit != null) {
            q.put("limit", r.limit);
        }
        if (r.offset != null) {
            q.put("offset", r.offset);
        }
        if (r.dateDlr != null) {
            q.put("date_dlr", r.dateDlr);
        }
        return classic("GET", "/reportbydate", null, null, null, q);
    }

    /** SMS balance. Returns {@link Balance} with the raw string and integer value. */
    public Balance getBalance() {
        Object res = classic("GET", "/balance", null, null, null, null);
        return balanceFrom(res);
    }

    /** Package-visible so the offline smoke test can exercise parsing without a network call. */
    static Balance balanceFrom(Object res) {
        String raw = null;
        if (res instanceof Map) {
            Object s = ((Map<?, ?>) res).get("saldo");
            if (s != null) {
                raw = String.valueOf(s);
            }
        }
        Long balance = null;
        if (raw != null) {
            String d = raw.replaceAll("\\D", "");
            balance = d.isEmpty() ? 0L : Long.parseLong(d);
        }
        return new Balance(raw, balance);
    }

    // =========================================================================
    // Conversational AI (PushAgent)
    // =========================================================================

    /** Open a conversation. */
    public Object openConversation(String userExtId, String name, String channel) {
        Map<String, Object> body = new LinkedHashMap<>();
        if (userExtId != null) {
            body.put("user_ext_id", userExtId);
        }
        if (name != null) {
            body.put("name", name);
        }
        if (channel != null) {
            body.put("channel", channel);
        }
        return v2("POST", "/v1/conversations", body, null, "pa");
    }

    /** Fetch the current state of a conversation (bot replies asynchronously). */
    public Object getConversation(Object id) {
        return v2("GET", "/v1/conversations/" + id, null, null, "pa");
    }

    /** Send a user message; the bot replies asynchronously. */
    public Object postMessage(Object id, String content) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("content", content);
        return v2("POST", "/v1/conversations/" + id + "/messages", body, null, "pa");
    }

    /** Hand the conversation over to a human agent. */
    public Object handoff(Object id) {
        return v2("POST", "/v1/conversations/" + id + "/handoff", new LinkedHashMap<String, Object>(), null, "pa");
    }

    /** Close the conversation. */
    public Object closeConversation(Object id) {
        return v2("POST", "/v1/conversations/" + id + "/close", new LinkedHashMap<String, Object>(), null, "pa");
    }

    /** Send a business event. */
    public Object sendEvent(String type, String userExtId, Object data) {
        Map<String, Object> body = new LinkedHashMap<>();
        if (type != null) {
            body.put("type", type);
        }
        if (userExtId != null) {
            body.put("user_ext_id", userExtId);
        }
        if (data != null) {
            body.put("data", data);
        }
        return v2("POST", "/v1/events", body, null, "pa");
    }

    /** Schedule a follow-up task on a conversation. */
    public Object scheduleTask(Object conversationId, String runAt, String text) {
        Map<String, Object> body = new LinkedHashMap<>();
        if (conversationId != null) {
            body.put("conversation_id", conversationId);
        }
        if (runAt != null) {
            body.put("run_at", runAt);
        }
        if (text != null) {
            body.put("text", text);
        }
        return v2("POST", "/v1/tasks", body, null, "pa");
    }

    // =========================================================================
    // Push Notifications resource
    // =========================================================================

    /** Server + public Push Notifications endpoints. */
    public static final class PushResource {
        private final Pushfy c;
        public final Devices devices;
        public final Campaigns campaigns;
        public final Segments segments;

        PushResource(Pushfy c) {
            this.c = c;
            this.devices = new Devices(c);
            this.campaigns = new Campaigns(c);
            this.segments = new Segments(c);
        }

        /** Send a test push (server API). */
        public Object test(Object body) {
            return c.v2("POST", "/v1/push/test", body, null, "push");
        }

        /** Public: subscribe a device (browser/app). Injects {@code app_id} automatically. */
        public Object subscribe(Map<String, Object> body) {
            return c.v2("POST", "/v1/push/subscribe", withAppId(c, body), null, "public");
        }

        /** Public: report a device event. Injects {@code app_id} automatically. */
        public Object track(Map<String, Object> body) {
            return c.v2("POST", "/v1/push/track", withAppId(c, body), null, "public");
        }

        /** Device registry (server API). */
        public static final class Devices {
            private final Pushfy c;

            Devices(Pushfy c) {
                this.c = c;
            }

            public Object list(Map<String, Object> query) {
                return c.v2("GET", "/v1/push/devices", null, query, "push");
            }

            public Object register(Object body) {
                return c.v2("POST", "/v1/push/devices", body, null, "push");
            }

            public Object remove(Object id) {
                return c.v2("DELETE", "/v1/push/devices/" + id, null, null, "push");
            }
        }

        /** Campaign management (server API). */
        public static final class Campaigns {
            private final Pushfy c;

            Campaigns(Pushfy c) {
                this.c = c;
            }

            public Object list(Map<String, Object> query) {
                return c.v2("GET", "/v1/push/campaigns", null, query, "push");
            }

            public Object create(Object body) {
                return c.v2("POST", "/v1/push/campaigns", body, null, "push");
            }

            public Object get(Object id) {
                return c.v2("GET", "/v1/push/campaigns/" + id, null, null, "push");
            }

            public Object update(Object id, Object body) {
                return c.v2("PATCH", "/v1/push/campaigns/" + id, body, null, "push");
            }

            public Object send(Object id) {
                return c.v2("POST", "/v1/push/campaigns/" + id + "/send",
                        new LinkedHashMap<String, Object>(), null, "push");
            }

            public Object metrics(Object id) {
                return c.v2("GET", "/v1/push/campaigns/" + id + "/metrics", null, null, "push");
            }
        }

        /** Audience segments (server API). */
        public static final class Segments {
            private final Pushfy c;

            Segments(Pushfy c) {
                this.c = c;
            }

            public Object list(Map<String, Object> query) {
                return c.v2("GET", "/v1/push/segments", null, query, "push");
            }

            public Object create(Object body) {
                return c.v2("POST", "/v1/push/segments", body, null, "push");
            }
        }

        private static Map<String, Object> withAppId(Pushfy c, Map<String, Object> body) {
            Map<String, Object> b = new LinkedHashMap<>();
            b.put("app_id", c.appId);
            if (body != null) {
                b.putAll(body);
            }
            return b;
        }
    }

    // =========================================================================
    // Transport
    // =========================================================================

    /** Messaging (classic) request against {@code https://portal.pushfy.com/<path>}. */
    Object classic(String method, String path, Object json, byte[] form, String formContentType,
                   Map<String, Object> query) {
        String url = baseUrl + path;
        String qs = buildQuery(query);
        if (!qs.isEmpty()) {
            url += (path.indexOf('?') >= 0 ? "&" : "?") + qs;
        }

        Map<String, String> headers = new LinkedHashMap<>();
        if (apiToken != null) {
            headers.put("Authorization", "Bearer " + apiToken);
        }

        byte[] body = null;
        if (form != null) {
            headers.put("Content-Type", formContentType);
            body = form;
        } else if (json != null) {
            headers.put("Content-Type", "application/json");
            body = Json.encode(json).getBytes(StandardCharsets.UTF_8);
        }
        return http(method, url, headers, body);
    }

    /** V2 request (Push / Conversational AI) via {@code ?r=<route>}. */
    Object v2(String method, String route, Object body, Map<String, Object> query, String auth) {
        StringBuilder qs = new StringBuilder();
        qs.append("r=").append(enc(route));
        String extra = buildQuery(query);
        if (!extra.isEmpty()) {
            qs.append('&').append(extra);
        }
        String url = baseUrl + v2Path + "?" + qs;

        String bodyStr = (body != null && !"GET".equals(method)) ? Json.encode(body) : "";

        Map<String, String> headers = new LinkedHashMap<>();
        if (!bodyStr.isEmpty()) {
            headers.put("Content-Type", "application/json");
        }

        if ("pa".equals(auth)) {
            if (paKey == null || paSecret == null) {
                throw new PushfyException("paKey/paSecret required for Conversational AI");
            }
            Hmac.Signed s = Hmac.sign(method, route, bodyStr, paSecret);
            headers.put("X-PA-Key", paKey);
            headers.put("X-PA-Timestamp", s.timestamp);
            headers.put("X-PA-Signature", s.signature);
        } else if ("push".equals(auth)) {
            if (pushKey == null || pushSecret == null) {
                throw new PushfyException("pushKey/pushSecret required for Push server API");
            }
            Hmac.Signed s = Hmac.sign(method, route, bodyStr, pushSecret);
            headers.put("X-PUSH-Key", pushKey);
            headers.put("X-PUSH-Timestamp", s.timestamp);
            headers.put("X-PUSH-Signature", s.signature);
        }
        // auth == "public" (or null): no signing.

        byte[] bodyBytes = bodyStr.isEmpty() ? null : bodyStr.getBytes(StandardCharsets.UTF_8);
        return http(method, url, headers, bodyBytes);
    }

    /** Low-level transport: sends the request and maps the response/status to a value or exception. */
    Object http(String method, String url, Map<String, String> headers, byte[] body) {
        HttpRequest.Builder rb = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofMillis(timeout));
        for (Map.Entry<String, String> e : headers.entrySet()) {
            rb.header(e.getKey(), e.getValue());
        }
        HttpRequest.BodyPublisher publisher = body != null
                ? HttpRequest.BodyPublishers.ofByteArray(body)
                : HttpRequest.BodyPublishers.noBody();
        rb.method(method, publisher);

        HttpResponse<String> res;
        try {
            res = httpClient.send(rb.build(), HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        } catch (IOException e) {
            throw new ApiException("Network error: " + e.getMessage(), 0, null, null);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ApiException("Network error: " + e.getMessage(), 0, null, null);
        }

        String text = res.body();
        Object parsed = null;
        if (text != null && !text.isEmpty()) {
            try {
                parsed = Json.parse(text);
            } catch (RuntimeException ex) {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("raw", text);
                parsed = m;
            }
        }

        int status = res.statusCode();
        if (status < 200 || status >= 300) {
            Object errBody;
            if (parsed instanceof Map) {
                Map<?, ?> pm = (Map<?, ?>) parsed;
                if (pm.get("error") != null) {
                    errBody = parsed;
                } else {
                    Map<String, Object> m = new LinkedHashMap<>();
                    Object raw = pm.get("raw");
                    m.put("error", raw != null ? raw : text);
                    errBody = m;
                }
            } else {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("error", text != null ? text : "error");
                errBody = m;
            }
            throw PushfyException.fromResponse(status, errBody);
        }
        return parsed;
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    private static String buildQuery(Map<String, Object> query) {
        if (query == null || query.isEmpty()) {
            return "";
        }
        StringBuilder qs = new StringBuilder();
        for (Map.Entry<String, Object> e : query.entrySet()) {
            if (e.getValue() == null) {
                continue;
            }
            if (qs.length() > 0) {
                qs.append('&');
            }
            qs.append(enc(e.getKey())).append('=').append(enc(String.valueOf(e.getValue())));
        }
        return qs.toString();
    }

    private static String enc(String s) {
        return URLEncoder.encode(s, StandardCharsets.UTF_8);
    }

    /** Strip everything but digits, mirroring the Node SDK's phone normalization. */
    static String digits(String s) {
        return s == null ? "" : s.replaceAll("\\D", "");
    }

    static Map<String, Object> toMessage(String to, String text, String extId, String audio) {
        Map<String, Object> out = new LinkedHashMap<>();
        List<Object> dests = new ArrayList<>();
        Map<String, Object> dest = new LinkedHashMap<>();
        dest.put("to", digits(to));
        dests.add(dest);
        out.put("destinations", dests);
        out.put("text", text);
        if (extId != null) {
            out.put("ext_id", extId);
        }
        if (audio != null) {
            out.put("audio", audio);
        }
        return out;
    }

    static byte[] multipart(String boundary, String name, byte[] data, String filename) {
        try {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            String head = "--" + boundary + "\r\n"
                    + "Content-Disposition: form-data; name=\"nome\"\r\n\r\n"
                    + name + "\r\n"
                    + "--" + boundary + "\r\n"
                    + "Content-Disposition: form-data; name=\"audio\"; filename=\"" + filename + "\"\r\n"
                    + "Content-Type: audio/mpeg\r\n\r\n";
            out.write(head.getBytes(StandardCharsets.UTF_8));
            if (data != null) {
                out.write(data);
            }
            out.write(("\r\n--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));
            return out.toByteArray();
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
    }

    // =========================================================================
    // Value types
    // =========================================================================

    /** A single SMS for {@link #sendBulkSms(List)}. */
    public static final class Sms {
        public String to;
        public String text;
        public String extId;

        public Sms() {
        }

        public Sms(String to, String text, String extId) {
            this.to = to;
            this.text = text;
            this.extId = extId;
        }
    }

    /** An RCS rich card for {@link #sendRcs(Rcs)}. */
    public static final class Rcs {
        public String to;
        public String title;
        public String text;
        public String url;
        public String cta;
        public String image;
        public String extId;

        public Rcs() {
        }

        public Rcs(String to, String text) {
            this.to = to;
            this.text = text;
        }
    }

    /** Query parameters for {@link #report(ReportQuery)}. All optional. */
    public static final class ReportQuery {
        public String date;
        public String start;
        public String end;
        public String event;
        public Integer limit;
        public Integer offset;
        public String dateDlr;
    }

    /** SMS balance: the raw formatted string ("1.500") and its integer value (1500). */
    public static final class Balance {
        public final String raw;
        public final Long balance;

        public Balance(String raw, Long balance) {
            this.raw = raw;
            this.balance = balance;
        }

        @Override
        public String toString() {
            return "Balance{raw=" + raw + ", balance=" + balance + '}';
        }
    }
}
