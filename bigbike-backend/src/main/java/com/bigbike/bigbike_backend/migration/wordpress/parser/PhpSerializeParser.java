package com.bigbike.bigbike_backend.migration.wordpress.parser;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * Parses PHP serialize() output sufficient for common WordPress metadata.
 *
 * Supported tokens: string (s), integer (i), boolean (b), double (d), null (N), array (a).
 * PHP objects (O) are warned and skipped — full object deserialization is not implemented.
 *
 * UTF-8 note: PHP serialize uses byte lengths. For purely ASCII content (widths, heights,
 * file paths, CSS classes, URL slugs) this parser is exact. For multibyte Vietnamese strings
 * stored in PHP-serialized metadata, the parser falls back to scanning for the closing delimiter
 * and emits a warning — acceptable for dry-run purposes.
 */
@Component
public class PhpSerializeParser {

    public record ParseResult(Object value, List<String> warnings) {}

    public ParseResult parse(String input) {
        if (input == null || input.isBlank()) {
            return new ParseResult(null, List.of("Empty PHP serialize input"));
        }
        List<String> warnings = new ArrayList<>();
        try {
            int[] pos = {0};
            Object value = parseValue(input, pos, warnings);
            return new ParseResult(value, warnings);
        } catch (Exception e) {
            return new ParseResult(null, List.of("PHP parse failed: " + e.getMessage()));
        }
    }

    private Object parseValue(String input, int[] pos, List<String> warnings) {
        if (pos[0] >= input.length()) {
            throw new IllegalStateException("Unexpected end of input at pos " + pos[0]);
        }
        char type = input.charAt(pos[0]);
        return switch (type) {
            case 's' -> parseString(input, pos, warnings);
            case 'i' -> parseInteger(input, pos, warnings);
            case 'b' -> parseBoolean(input, pos);
            case 'd' -> parseDouble(input, pos, warnings);
            case 'N' -> parseNull(input, pos);
            case 'a' -> parseArray(input, pos, warnings);
            case 'O' -> {
                warnings.add("PHP object at pos " + pos[0] + " — skipped");
                skipObject(input, pos);
                yield null;
            }
            default -> throw new IllegalStateException(
                    "Unknown PHP serialize type '" + type + "' at pos " + pos[0]);
        };
    }

    // s:N:"value";
    private String parseString(String input, int[] pos, List<String> warnings) {
        expect(input, pos, 's');
        expect(input, pos, ':');
        int declaredLen = readInt(input, pos);
        expect(input, pos, ':');
        expect(input, pos, '"');

        int start = pos[0];

        // Fast path: ASCII content where byte length == char length
        if (start + declaredLen <= input.length()
                && start + declaredLen + 1 < input.length()
                && input.charAt(start + declaredLen) == '"'
                && input.charAt(start + declaredLen + 1) == ';') {
            String value = input.substring(start, start + declaredLen);
            pos[0] = start + declaredLen + 2;
            return value;
        }

        // Slow path: multibyte UTF-8 — PHP byte length doesn't match Java char length.
        // Scan forward for the closing ";  This is safe for metadata fields that don't
        // embed literal `"` followed by `;` inside their values (paths, CSS classes, URIs).
        int scanPos = start;
        while (scanPos < input.length()) {
            if (input.charAt(scanPos) == '"'
                    && scanPos + 1 < input.length()
                    && input.charAt(scanPos + 1) == ';') {
                String value = input.substring(start, scanPos);
                pos[0] = scanPos + 2;
                if (scanPos - start != declaredLen) {
                    warnings.add("PHP string length mismatch: declared=" + declaredLen
                            + " actual=" + (scanPos - start) + " (multibyte UTF-8?)");
                }
                return value;
            }
            scanPos++;
        }

        warnings.add("PHP string not terminated, truncating");
        String value = input.substring(start, Math.min(start + declaredLen, input.length()));
        pos[0] = input.length();
        return value;
    }

    // i:42; or i:-5;
    private Long parseInteger(String input, int[] pos, List<String> warnings) {
        expect(input, pos, 'i');
        expect(input, pos, ':');
        int start = pos[0];
        while (pos[0] < input.length() && input.charAt(pos[0]) != ';') pos[0]++;
        String num = input.substring(start, pos[0]);
        expect(input, pos, ';');
        try {
            return Long.parseLong(num);
        } catch (NumberFormatException e) {
            warnings.add("Cannot parse PHP integer: " + num);
            return null;
        }
    }

    // b:1; or b:0;
    private Boolean parseBoolean(String input, int[] pos) {
        expect(input, pos, 'b');
        expect(input, pos, ':');
        char val = input.charAt(pos[0]++);
        expect(input, pos, ';');
        return val == '1';
    }

    // d:3.14;
    private Double parseDouble(String input, int[] pos, List<String> warnings) {
        expect(input, pos, 'd');
        expect(input, pos, ':');
        int start = pos[0];
        while (pos[0] < input.length() && input.charAt(pos[0]) != ';') pos[0]++;
        String num = input.substring(start, pos[0]);
        expect(input, pos, ';');
        try {
            return Double.parseDouble(num);
        } catch (NumberFormatException e) {
            warnings.add("Cannot parse PHP double: " + num);
            return null;
        }
    }

    // N;
    private Object parseNull(String input, int[] pos) {
        expect(input, pos, 'N');
        expect(input, pos, ';');
        return null;
    }

    // a:N:{key value key value ...}
    private Map<Object, Object> parseArray(String input, int[] pos, List<String> warnings) {
        expect(input, pos, 'a');
        expect(input, pos, ':');
        int length = readInt(input, pos);
        expect(input, pos, ':');
        expect(input, pos, '{');
        Map<Object, Object> map = new LinkedHashMap<>();
        for (int i = 0; i < length; i++) {
            // End of input OR closing brace = array shorter than declared (malformed but common)
            if (pos[0] >= input.length() || input.charAt(pos[0]) == '}') {
                if (i < length) {
                    warnings.add("PHP array truncated: found " + i + " of " + length + " elements");
                }
                break;
            }
            Object key = parseValue(input, pos, warnings);
            if (pos[0] >= input.length()) {
                warnings.add("PHP array missing value for key: " + key);
                break;
            }
            Object value = parseValue(input, pos, warnings);
            if (key != null) map.put(key, value);
        }
        if (pos[0] < input.length() && input.charAt(pos[0]) == '}') pos[0]++;
        return map;
    }

    // Skip over a PHP object O:...:...:{...}
    private void skipObject(String input, int[] pos) {
        while (pos[0] < input.length() && input.charAt(pos[0]) != '{') pos[0]++;
        if (pos[0] >= input.length()) return;
        int depth = 0;
        while (pos[0] < input.length()) {
            char c = input.charAt(pos[0]++);
            if (c == '{') depth++;
            else if (c == '}') { depth--; if (depth == 0) break; }
        }
    }

    private void expect(String input, int[] pos, char expected) {
        if (pos[0] >= input.length()) {
            throw new IllegalStateException(
                    "Expected '" + expected + "' but reached end of input (pos=" + pos[0] + ")");
        }
        char actual = input.charAt(pos[0]);
        if (actual != expected) {
            throw new IllegalStateException(
                    "Expected '" + expected + "' but got '" + actual + "' at pos " + pos[0]);
        }
        pos[0]++;
    }

    private int readInt(String input, int[] pos) {
        int start = pos[0];
        if (pos[0] < input.length() && input.charAt(pos[0]) == '-') pos[0]++;
        while (pos[0] < input.length() && Character.isDigit(input.charAt(pos[0]))) pos[0]++;
        if (pos[0] == start) throw new IllegalStateException("Expected integer at pos " + pos[0]);
        return Integer.parseInt(input.substring(start, pos[0]));
    }

    /**
     * Convenience: extract a Long value from a parsed Map by String key.
     */
    public static Long getLong(Map<Object, Object> map, String key) {
        if (map == null) return null;
        Object v = map.get(key);
        if (v instanceof Long l) return l;
        if (v instanceof Number n) return n.longValue();
        if (v instanceof String s) {
            try { return Long.parseLong(s.trim()); } catch (NumberFormatException ignored) {}
        }
        return null;
    }

    /**
     * Convenience: extract a String value from a parsed Map by String key.
     */
    public static String getString(Map<Object, Object> map, String key) {
        if (map == null) return null;
        Object v = map.get(key);
        return v != null ? v.toString() : null;
    }
}
