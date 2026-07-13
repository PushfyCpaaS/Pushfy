package com.pushfy;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Minimal, dependency-free JSON encoder/parser used internally by the SDK.
 *
 * <p>Encoding accepts {@link Map} (object), {@link Iterable}/array (array),
 * {@link String}, {@link Number}, {@link Boolean} and {@code null}. Parsing
 * returns {@link LinkedHashMap} (preserving key order), {@link ArrayList},
 * {@link String}, {@link Long}/{@link Double}, {@link Boolean} and {@code null}.
 *
 * <p>This is intentionally small — it is not a general-purpose JSON library, but
 * it round-trips the request/response shapes the Pushfy API uses.
 */
final class Json {

    private Json() {
    }

    // ---- encode --------------------------------------------------------------

    static String encode(Object o) {
        StringBuilder sb = new StringBuilder();
        write(sb, o);
        return sb.toString();
    }

    private static void write(StringBuilder sb, Object o) {
        if (o == null) {
            sb.append("null");
        } else if (o instanceof String) {
            writeString(sb, (String) o);
        } else if (o instanceof Boolean) {
            sb.append(o.toString());
        } else if (o instanceof Number) {
            sb.append(numberToString((Number) o));
        } else if (o instanceof Map) {
            writeMap(sb, (Map<?, ?>) o);
        } else if (o instanceof Iterable) {
            writeArray(sb, (Iterable<?>) o);
        } else if (o instanceof Object[]) {
            List<Object> l = new ArrayList<>();
            for (Object x : (Object[]) o) {
                l.add(x);
            }
            writeArray(sb, l);
        } else {
            writeString(sb, o.toString());
        }
    }

    private static String numberToString(Number n) {
        if (n instanceof Double || n instanceof Float) {
            double d = n.doubleValue();
            if (!Double.isInfinite(d) && !Double.isNaN(d) && d == Math.floor(d)
                    && Math.abs(d) < 9.007199254740992E15) {
                return Long.toString((long) d);
            }
        }
        return n.toString();
    }

    private static void writeMap(StringBuilder sb, Map<?, ?> m) {
        sb.append('{');
        boolean first = true;
        for (Map.Entry<?, ?> e : m.entrySet()) {
            if (!first) {
                sb.append(',');
            }
            first = false;
            writeString(sb, String.valueOf(e.getKey()));
            sb.append(':');
            write(sb, e.getValue());
        }
        sb.append('}');
    }

    private static void writeArray(StringBuilder sb, Iterable<?> it) {
        sb.append('[');
        boolean first = true;
        for (Object x : it) {
            if (!first) {
                sb.append(',');
            }
            first = false;
            write(sb, x);
        }
        sb.append(']');
    }

    private static void writeString(StringBuilder sb, String s) {
        sb.append('"');
        for (int i = 0; i < s.length(); i++) {
            char ch = s.charAt(i);
            switch (ch) {
                case '"':
                    sb.append("\\\"");
                    break;
                case '\\':
                    sb.append("\\\\");
                    break;
                case '\n':
                    sb.append("\\n");
                    break;
                case '\r':
                    sb.append("\\r");
                    break;
                case '\t':
                    sb.append("\\t");
                    break;
                case '\b':
                    sb.append("\\b");
                    break;
                case '\f':
                    sb.append("\\f");
                    break;
                default:
                    if (ch < 0x20) {
                        sb.append(String.format("\\u%04x", (int) ch));
                    } else {
                        sb.append(ch);
                    }
            }
        }
        sb.append('"');
    }

    // ---- parse ---------------------------------------------------------------

    static Object parse(String s) {
        Parser p = new Parser(s);
        p.ws();
        Object v = p.value();
        p.ws();
        if (!p.eof()) {
            throw new RuntimeException("Unexpected trailing content at index " + p.i);
        }
        return v;
    }

    private static final class Parser {
        final String s;
        int i;

        Parser(String s) {
            this.s = s;
            this.i = 0;
        }

        boolean eof() {
            return i >= s.length();
        }

        char cur() {
            return s.charAt(i);
        }

        void ws() {
            while (i < s.length()) {
                char c = s.charAt(i);
                if (c == ' ' || c == '\t' || c == '\n' || c == '\r') {
                    i++;
                } else {
                    break;
                }
            }
        }

        Object value() {
            if (eof()) {
                throw new RuntimeException("Unexpected end of JSON");
            }
            char c = cur();
            switch (c) {
                case '{':
                    return object();
                case '[':
                    return array();
                case '"':
                    return string();
                case 't':
                case 'f':
                    return bool();
                case 'n':
                    return nul();
                default:
                    return number();
            }
        }

        Map<String, Object> object() {
            Map<String, Object> m = new LinkedHashMap<>();
            i++; // consume '{'
            ws();
            if (!eof() && cur() == '}') {
                i++;
                return m;
            }
            while (true) {
                ws();
                if (eof() || cur() != '"') {
                    throw new RuntimeException("Expected object key at index " + i);
                }
                String k = string();
                ws();
                if (eof() || cur() != ':') {
                    throw new RuntimeException("Expected ':' at index " + i);
                }
                i++; // consume ':'
                ws();
                m.put(k, value());
                ws();
                if (eof()) {
                    throw new RuntimeException("Unterminated object");
                }
                char c = cur();
                if (c == ',') {
                    i++;
                    continue;
                }
                if (c == '}') {
                    i++;
                    break;
                }
                throw new RuntimeException("Expected ',' or '}' at index " + i);
            }
            return m;
        }

        List<Object> array() {
            List<Object> l = new ArrayList<>();
            i++; // consume '['
            ws();
            if (!eof() && cur() == ']') {
                i++;
                return l;
            }
            while (true) {
                ws();
                l.add(value());
                ws();
                if (eof()) {
                    throw new RuntimeException("Unterminated array");
                }
                char c = cur();
                if (c == ',') {
                    i++;
                    continue;
                }
                if (c == ']') {
                    i++;
                    break;
                }
                throw new RuntimeException("Expected ',' or ']' at index " + i);
            }
            return l;
        }

        String string() {
            StringBuilder sb = new StringBuilder();
            i++; // consume opening quote
            while (!eof()) {
                char c = s.charAt(i++);
                if (c == '"') {
                    return sb.toString();
                }
                if (c == '\\') {
                    if (eof()) {
                        break;
                    }
                    char e = s.charAt(i++);
                    switch (e) {
                        case '"':
                            sb.append('"');
                            break;
                        case '\\':
                            sb.append('\\');
                            break;
                        case '/':
                            sb.append('/');
                            break;
                        case 'n':
                            sb.append('\n');
                            break;
                        case 'r':
                            sb.append('\r');
                            break;
                        case 't':
                            sb.append('\t');
                            break;
                        case 'b':
                            sb.append('\b');
                            break;
                        case 'f':
                            sb.append('\f');
                            break;
                        case 'u':
                            if (i + 4 > s.length()) {
                                throw new RuntimeException("Bad unicode escape");
                            }
                            String hex = s.substring(i, i + 4);
                            i += 4;
                            sb.append((char) Integer.parseInt(hex, 16));
                            break;
                        default:
                            throw new RuntimeException("Bad escape \\" + e);
                    }
                } else {
                    sb.append(c);
                }
            }
            throw new RuntimeException("Unterminated string");
        }

        Object number() {
            int start = i;
            if (!eof() && cur() == '-') {
                i++;
            }
            while (!eof()) {
                char c = cur();
                if ((c >= '0' && c <= '9') || c == '+' || c == '-'
                        || c == '.' || c == 'e' || c == 'E') {
                    i++;
                } else {
                    break;
                }
            }
            String num = s.substring(start, i);
            if (num.isEmpty()) {
                throw new RuntimeException("Invalid number at index " + start);
            }
            if (num.indexOf('.') >= 0 || num.indexOf('e') >= 0 || num.indexOf('E') >= 0) {
                return Double.parseDouble(num);
            }
            try {
                return Long.parseLong(num);
            } catch (NumberFormatException ex) {
                return Double.parseDouble(num);
            }
        }

        Boolean bool() {
            if (s.startsWith("true", i)) {
                i += 4;
                return Boolean.TRUE;
            }
            if (s.startsWith("false", i)) {
                i += 5;
                return Boolean.FALSE;
            }
            throw new RuntimeException("Invalid literal at index " + i);
        }

        Object nul() {
            if (s.startsWith("null", i)) {
                i += 4;
                return null;
            }
            throw new RuntimeException("Invalid literal at index " + i);
        }
    }
}
