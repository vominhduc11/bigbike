package com.bigbike.bigbike_backend.service.admin.settings;

import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.service.security.SafeMediaAssetUrlPolicy;
import java.math.BigDecimal;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.HashSet;
import java.util.Set;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Component
@RequiredArgsConstructor
public class SettingValueValidator {

    // IMAGE_URL settings (hero banners, OG image…) must point at an approved media source —
    // the admin media picker stores relative /media/... paths, so reuse the shared whitelist
    // policy instead of the generic URL check (which rejected relative paths → HTTP 400 on save).
    private final SafeMediaAssetUrlPolicy safeMediaAssetUrlPolicy;
    private final ObjectMapper objectMapper;

    private static final Pattern EMAIL_PATTERN = Pattern.compile(
            "^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$");
    private static final Pattern PHONE_PATTERN = Pattern.compile(
            "^[+0-9][0-9 .()\\-]{4,30}$");
    private static final Pattern INTEGER_PATTERN = Pattern.compile("^-?\\d+$");

    private static final int MAX_STRING_LENGTH = 1_000;
    private static final int MAX_LONG_TEXT_LENGTH = 65_536;
    private static final int MAX_HTML_LENGTH = 262_144;

    private static final Set<String> GOOGLE_MAPS_ONLY_KEYS = Set.of("google_maps_url");
    private static final Set<String> GOOGLE_MAPS_ALLOWED_HOSTS = Set.of(
            "www.google.com", "google.com", "maps.google.com");

    // product_assign_roles: dynamic role list backing the "Phân công" banner (product + content
    // editors). Frontend mirrors this same 1–6 limit in bigbike-admin/src/screens/settings/constants.js
    // (MIN_ASSIGNMENT_ROLES/MAX_ASSIGNMENT_ROLES) — no shared-constant mechanism across the JVM/JS
    // boundary, keep both in sync by hand if this ever changes.
    private static final String PRODUCT_ASSIGN_ROLES_KEY = "product_assign_roles";
    private static final int MIN_ASSIGNMENT_ROLES = 1;
    private static final int MAX_ASSIGNMENT_ROLES = 6;

    public void validate(String key, String rawValue, SettingDefinition def) {
        if (rawValue == null) return;

        if (def.required() && rawValue.isBlank()) {
            throw fail(key, "REQUIRED", "Setting value must not be blank.");
        }
        if (rawValue.isBlank()) return;

        validateByType(key, rawValue, def);
    }

    /**
     * Tiếng Anh chỉ bắt buộc khi setting vừa dịch-được (kiểu chữ tự do) vừa bắt buộc ở VI
     * (TRANSLATION_RULE_002). {@code effectiveValueEn} phải là giá trị SAU KHI áp dụng patch
     * (giữ nguyên giá trị cũ nếu request không gửi {@code valueEn}), không phải raw request field.
     */
    public void validateRequiredEn(String key, String effectiveValueEn, SettingDefinition def) {
        if (!def.required() || !isFreeTextType(def.type())) return;
        if (effectiveValueEn == null || effectiveValueEn.isBlank()) {
            throw ValidationException.fromField("valueEn", "REQUIRED",
                    "Setting English value must not be blank. (key=" + key + ")");
        }
    }

    private static boolean isFreeTextType(SettingValueType type) {
        return type == SettingValueType.STRING || type == SettingValueType.HTML || type == SettingValueType.LONG_TEXT;
    }

    private void validateByType(String key, String rawValue, SettingDefinition def) {

        switch (def.type()) {
            case STRING -> validateLength(key, rawValue, MAX_STRING_LENGTH);
            case LONG_TEXT -> validateLength(key, rawValue, MAX_LONG_TEXT_LENGTH);
            case HTML -> {
                validateLength(key, rawValue, MAX_HTML_LENGTH);
                validateHtmlImageSources(key, rawValue);
            }
            case BOOLEAN -> validateBoolean(key, rawValue);
            case INTEGER -> validateInteger(key, rawValue, def);
            case DECIMAL, MONEY -> validateDecimal(key, rawValue, def);
            case URL -> {
                if (GOOGLE_MAPS_ONLY_KEYS.contains(key)) {
                    validateGoogleMapsUrl(key, rawValue);
                } else {
                    validateUrl(key, rawValue, true);
                }
            }
            case IMAGE_URL -> safeMediaAssetUrlPolicy.validateImageUrlOrThrow(rawValue, "value");
            case EMAIL -> validateEmail(key, rawValue);
            case PHONE -> validatePhone(key, rawValue);
            case ENUM -> validateEnum(key, rawValue, def);
            case JSON -> validateJson(key, rawValue, def);
        }
    }

    private void validateLength(String key, String value, int max) {
        if (value.length() > max) {
            throw fail(key, "TOO_LONG", "Value exceeds " + max + " characters.");
        }
    }

    // Matches image sources embedded in HTML: <img src="…">, srcset URLs, and CSS
    // background url(…). Case-insensitive; captures the URL in group 1/2/3.
    private static final Pattern HTML_IMAGE_SRC_PATTERN = Pattern.compile(
            "(?i)(?:<img\\b[^>]*?\\bsrc\\s*=\\s*[\"']([^\"']+)[\"'])"
            + "|(?:\\bsrcset\\s*=\\s*[\"']([^\"']+)[\"'])"
            + "|(?:url\\(\\s*[\"']?([^\"')]+)[\"']?\\s*\\))");

    /**
     * HTML settings must not embed external images or tracking pixels — every image source
     * has to be an approved MinIO/media URL, same as admin-managed media (AUD-036, AGENTS §14.3).
     * data: URIs and external hosts are rejected so a saved HTML block can't hotlink or beacon.
     */
    private void validateHtmlImageSources(String key, String html) {
        var matcher = HTML_IMAGE_SRC_PATTERN.matcher(html);
        while (matcher.find()) {
            String imgSrc = matcher.group(1);
            String srcset = matcher.group(2);
            String cssUrl = matcher.group(3);
            if (imgSrc != null) {
                requireApprovedImage(key, imgSrc.trim());
            }
            if (cssUrl != null) {
                requireApprovedImage(key, cssUrl.trim());
            }
            if (srcset != null) {
                // srcset = comma-separated "url descriptor" pairs — validate each URL.
                for (String candidate : srcset.split(",")) {
                    String url = candidate.trim().split("\\s+")[0];
                    if (!url.isEmpty()) requireApprovedImage(key, url);
                }
            }
        }
    }

    private void requireApprovedImage(String key, String url) {
        if (!safeMediaAssetUrlPolicy.isAllowedImageUrl(url)) {
            throw fail(key, "EXTERNAL_IMAGE",
                    "Ảnh trong HTML phải là ảnh nội bộ (MinIO/media). Không được nhúng ảnh/pixel từ host ngoài: " + url);
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

    private void validateGoogleMapsUrl(String key, String value) {
        String trimmed = value.trim();
        try {
            URI uri = new URI(trimmed);
            if (!"https".equalsIgnoreCase(uri.getScheme())) {
                throw fail(key, "INVALID_GOOGLE_MAPS_URL",
                        "Google Maps URL must use https:// scheme.");
            }
            String host = uri.getHost();
            if (host == null || !GOOGLE_MAPS_ALLOWED_HOSTS.contains(host.toLowerCase())) {
                throw fail(key, "INVALID_GOOGLE_MAPS_URL",
                        "URL must be a Google Maps embed URL (www.google.com, google.com, or maps.google.com).");
            }
            String path = uri.getPath();
            if (path == null || !path.startsWith("/maps")) {
                throw fail(key, "INVALID_GOOGLE_MAPS_URL",
                        "Google Maps URL path must start with /maps.");
            }
        } catch (URISyntaxException e) {
            throw fail(key, "INVALID_GOOGLE_MAPS_URL", "Value is not a valid URL.");
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

    private void validateJson(String key, String rawValue, SettingDefinition def) {
        validateLength(key, rawValue, MAX_LONG_TEXT_LENGTH);
        JsonNode node;
        try {
            node = objectMapper.readTree(rawValue);
        } catch (JacksonException e) {
            throw fail(key, "NOT_JSON", "Value is not valid JSON.");
        }
        if (PRODUCT_ASSIGN_ROLES_KEY.equals(key)) {
            validateProductAssignRoles(key, node);
        }
    }

    private void validateProductAssignRoles(String key, JsonNode node) {
        if (!node.isArray()) {
            throw fail(key, "NOT_ARRAY", "Value must be a JSON array of roles.");
        }
        if (node.size() < MIN_ASSIGNMENT_ROLES) {
            throw fail(key, "TOO_FEW_ROLES", "At least " + MIN_ASSIGNMENT_ROLES + " role is required.");
        }
        if (node.size() > MAX_ASSIGNMENT_ROLES) {
            throw fail(key, "TOO_MANY_ROLES", "At most " + MAX_ASSIGNMENT_ROLES + " roles are allowed.");
        }
        Set<String> seenIds = new HashSet<>();
        for (JsonNode role : node) {
            String id = role.path("id").asString("");
            if (id.isBlank()) {
                throw fail(key, "ROLE_ID_REQUIRED", "Each role must have a non-blank id.");
            }
            if (!seenIds.add(id)) {
                throw fail(key, "ROLE_ID_DUPLICATE", "Role id must be unique: " + id);
            }
            String name = role.path("name").asString("");
            if (name.isBlank()) {
                throw fail(key, "ROLE_NAME_REQUIRED", "Each role must have a non-blank name.");
            }
            if (name.length() > MAX_STRING_LENGTH) {
                throw fail(key, "ROLE_NAME_TOO_LONG", "Role name exceeds " + MAX_STRING_LENGTH + " characters.");
            }
            JsonNode itemsNode = role.path("items");
            if (!itemsNode.isString()) {
                throw fail(key, "ROLE_ITEMS_INVALID", "Role items must be a string.");
            }
            if (itemsNode.asString("").length() > MAX_LONG_TEXT_LENGTH) {
                throw fail(key, "ROLE_ITEMS_TOO_LONG", "Role items exceeds " + MAX_LONG_TEXT_LENGTH + " characters.");
            }
        }
    }

    private static ValidationException fail(String key, String code, String message) {
        return ValidationException.fromField("value", code, message + " (key=" + key + ")");
    }
}
