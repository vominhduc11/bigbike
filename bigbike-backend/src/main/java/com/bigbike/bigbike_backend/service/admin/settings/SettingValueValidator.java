package com.bigbike.bigbike_backend.service.admin.settings;

import com.bigbike.bigbike_backend.api.error.ValidationException;
import java.math.BigDecimal;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

@Component
public class SettingValueValidator {

    private static final Pattern EMAIL_PATTERN = Pattern.compile(
            "^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$");
    private static final Pattern PHONE_PATTERN = Pattern.compile(
            "^[+0-9][0-9 .()\\-]{4,30}$");
    private static final Pattern INTEGER_PATTERN = Pattern.compile("^-?\\d+$");

    private static final int MAX_STRING_LENGTH = 1_000;
    private static final int MAX_LONG_TEXT_LENGTH = 65_536;
    private static final int MAX_HTML_LENGTH = 262_144;

    public void validate(String key, String rawValue, SettingDefinition def) {
        if (rawValue == null) return;

        if (def.required() && rawValue.isBlank()) {
            throw fail(key, "REQUIRED", "Setting value must not be blank.");
        }
        if (rawValue.isBlank()) return;

        switch (def.type()) {
            case STRING -> validateLength(key, rawValue, MAX_STRING_LENGTH);
            case LONG_TEXT -> validateLength(key, rawValue, MAX_LONG_TEXT_LENGTH);
            case HTML -> validateLength(key, rawValue, MAX_HTML_LENGTH);
            case BOOLEAN -> validateBoolean(key, rawValue);
            case INTEGER -> validateInteger(key, rawValue, def);
            case DECIMAL, MONEY -> validateDecimal(key, rawValue, def);
            case URL -> validateUrl(key, rawValue, true);
            case IMAGE_URL -> validateUrl(key, rawValue, false);
            case EMAIL -> validateEmail(key, rawValue);
            case PHONE -> validatePhone(key, rawValue);
            case ENUM -> validateEnum(key, rawValue, def);
        }
    }

    private void validateLength(String key, String value, int max) {
        if (value.length() > max) {
            throw fail(key, "TOO_LONG", "Value exceeds " + max + " characters.");
        }
    }

    private void validateBoolean(String key, String value) {
        String v = value.trim().toLowerCase();
        if (!(v.equals("true") || v.equals("false"))) {
            throw fail(key, "NOT_BOOLEAN", "Value must be 'true' or 'false'.");
        }
    }

    private void validateInteger(String key, String value, SettingDefinition def) {
        String v = value.trim();
        if (!INTEGER_PATTERN.matcher(v).matches()) {
            throw fail(key, "NOT_INTEGER", "Value must be a whole number.");
        }
        BigDecimal n;
        try {
            n = new BigDecimal(v);
        } catch (NumberFormatException nfe) {
            throw fail(key, "NOT_INTEGER", "Value must be a whole number.");
        }
        checkRange(key, n, def);
    }

    private void validateDecimal(String key, String value, SettingDefinition def) {
        BigDecimal n;
        try {
            n = new BigDecimal(value.trim());
        } catch (NumberFormatException nfe) {
            throw fail(key, "NOT_NUMERIC", "Value must be a number.");
        }
        checkRange(key, n, def);
    }

    private void checkRange(String key, BigDecimal n, SettingDefinition def) {
        if (def.min() != null && n.compareTo(def.min()) < 0) {
            throw fail(key, "BELOW_MIN", "Value must be >= " + def.min().toPlainString() + ".");
        }
        if (def.max() != null && n.compareTo(def.max()) > 0) {
            throw fail(key, "ABOVE_MAX", "Value must be <= " + def.max().toPlainString() + ".");
        }
    }

    private void validateUrl(String key, String value, boolean allowRelative) {
        String trimmed = value.trim();
        if (allowRelative && trimmed.startsWith("/")) {
            return;
        }
        try {
            URI uri = new URI(trimmed);
            String scheme = uri.getScheme();
            if (scheme == null || (!scheme.equalsIgnoreCase("http") && !scheme.equalsIgnoreCase("https"))) {
                throw fail(key, "INVALID_URL", "URL must use http:// or https:// scheme.");
            }
            if (uri.getHost() == null || uri.getHost().isBlank()) {
                throw fail(key, "INVALID_URL", "URL must include a host.");
            }
        } catch (URISyntaxException e) {
            throw fail(key, "INVALID_URL", "Value is not a valid URL.");
        }
    }

    private void validateEmail(String key, String value) {
        if (!EMAIL_PATTERN.matcher(value.trim()).matches()) {
            throw fail(key, "INVALID_EMAIL", "Value is not a valid email address.");
        }
    }

    private void validatePhone(String key, String value) {
        if (!PHONE_PATTERN.matcher(value.trim()).matches()) {
            throw fail(key, "INVALID_PHONE", "Value is not a valid phone number.");
        }
    }

    private void validateEnum(String key, String value, SettingDefinition def) {
        if (def.allowedValues() == null || def.allowedValues().isEmpty()) return;
        String trimmed = value.trim();
        if (!def.allowedValues().contains(trimmed)) {
            throw fail(key, "NOT_IN_ENUM",
                    "Value must be one of: " + String.join(", ", def.allowedValues()));
        }
    }

    private static ValidationException fail(String key, String code, String message) {
        return ValidationException.fromField("value", code, message + " (key=" + key + ")");
    }
}
