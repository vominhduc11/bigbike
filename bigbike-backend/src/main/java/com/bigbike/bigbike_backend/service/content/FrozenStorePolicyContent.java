package com.bigbike.bigbike_backend.service.content;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Map;
import java.util.Objects;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

/**
 * The single source for the bilingual Warranty and Returns policy documents.
 *
 * <p>The resources intentionally contain contact placeholders. Contact values are injected by
 * {@link StorePolicyService} from the live contact settings before the document is returned.
 */
@Component
public final class FrozenStorePolicyContent {

    public static final Instant FROZEN_AT = Instant.parse("2026-09-01T00:00:00Z");

    private static final Map<String, String> RESOURCE_PATHS = Map.of(
            key("warranty", "vi"), "policy-content/warranty.vi.html",
            key("warranty", "en"), "policy-content/warranty.en.html",
            key("return-exchange", "vi"), "policy-content/return-exchange.vi.html",
            key("return-exchange", "en"), "policy-content/return-exchange.en.html");

    private static final Map<String, String> TITLES = Map.of(
            key("warranty", "vi"), "Chính sách bảo hành",
            key("warranty", "en"), "Warranty Policy",
            key("return-exchange", "vi"), "Chính sách đổi trả hàng",
            key("return-exchange", "en"), "Returns and Exchanges Policy");

    private final Map<String, String> bodies;

    public FrozenStorePolicyContent() {
        this.bodies = RESOURCE_PATHS.entrySet().stream()
                .collect(java.util.stream.Collectors.toUnmodifiableMap(
                        Map.Entry::getKey, entry -> readRequired(entry.getValue())));
    }

    FrozenStorePolicyContent(Map<String, String> bodies) {
        this.bodies = Map.copyOf(bodies);
    }

    public PolicyDocument get(String topic, String lang) {
        String lookupKey = key(topic, lang);
        String body = bodies.get(lookupKey);
        String title = TITLES.get(lookupKey);
        if (body == null || title == null) {
            throw new IllegalArgumentException("Unsupported frozen policy: " + topic + "/" + lang);
        }
        return new PolicyDocument(topic, title, body);
    }

    private static String key(String topic, String lang) {
        return topic + "|" + lang;
    }

    private static String readRequired(String path) {
        ClassPathResource resource = new ClassPathResource(path);
        try (InputStream stream = resource.getInputStream()) {
            String content = new String(stream.readAllBytes(), StandardCharsets.UTF_8);
            if (content.isBlank()) {
                throw new IllegalStateException("Frozen policy resource is empty: " + path);
            }
            return content;
        } catch (IOException exception) {
            throw new IllegalStateException("Frozen policy resource is missing: " + path, exception);
        }
    }

    public record PolicyDocument(String topic, String title, String bodyHtml) {
        public PolicyDocument {
            Objects.requireNonNull(topic, "topic");
            Objects.requireNonNull(title, "title");
            Objects.requireNonNull(bodyHtml, "bodyHtml");
        }
    }
}
