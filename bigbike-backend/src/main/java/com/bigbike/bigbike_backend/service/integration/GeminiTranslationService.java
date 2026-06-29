package com.bigbike.bigbike_backend.service.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

/**
 * Server-side VI→EN auto-translation via Google Gemini. Replaces the old in-browser
 * call (which exposed the API key in the admin bundle). The key stays server-side.
 *
 * <p>Translation NEVER blocks a save: a blank api-key, an API error, or a malformed
 * response all return an empty map so the caller proceeds and leaves English untouched.
 *
 * <p>Input/output is a flat {@code Map<String,String>} of {@code field -> text}. HTML
 * values are preserved (only inner text is translated) — same prompt contract the admin
 * previously used in {@code lib/geminiTranslate.js}.
 */
@Service
@Slf4j
public class GeminiTranslationService {

    private static final String ENDPOINT =
            "https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s";

    private final String apiKey;
    private final String model;
    private final RestClient restClient;
    // Self-contained mapper (this app does not expose an ObjectMapper bean for injection).
    private final ObjectMapper objectMapper = new ObjectMapper();

    public GeminiTranslationService(
            @Value("${bigbike.gemini.api-key:}") String apiKey,
            @Value("${bigbike.gemini.model:gemini-2.5-flash}") String model) {
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.model = model == null || model.isBlank() ? "gemini-2.5-flash" : model.trim();
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout((int) Duration.ofSeconds(5).toMillis());
        factory.setReadTimeout((int) Duration.ofSeconds(60).toMillis());
        this.restClient = RestClient.builder().requestFactory(factory).build();
        log.info("GeminiTranslationService enabled={} model={}", isEnabled(), this.model);
    }

    /** True when an API key is configured. When false, {@link #translate} is a no-op. */
    public boolean isEnabled() {
        return !apiKey.isBlank();
    }

    /**
     * Translate every value (Vietnamese) to English, keeping the same keys. Returns an
     * empty map when disabled / on any failure so callers can safely skip enrichment.
     */
    public Map<String, String> translate(Map<String, String> source) {
        if (!isEnabled() || source == null || source.isEmpty()) {
            return Map.of();
        }
        try {
            String sourceJson = objectMapper.writeValueAsString(source);
            String prompt = "Translate the following JSON object's string values from Vietnamese to "
                    + "English. Retain all keys. Translate the values to natural English. If a value is "
                    + "HTML, preserve all HTML tags and properties exactly and translate only the text "
                    + "inside. If a value is already in English, keep it as is. Do not include markdown "
                    + "code block formatting (i.e. return ONLY raw JSON).\n\nJSON to translate:\n" + sourceJson;

            Map<String, Object> body = Map.of(
                    "contents", new Object[] {
                            Map.of("parts", new Object[] { Map.of("text", prompt) })
                    },
                    "generationConfig", Map.of("responseMimeType", "application/json"));

            String response = restClient.post()
                    .uri(String.format(ENDPOINT, model, apiKey))
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(String.class);

            JsonNode root = objectMapper.readTree(response);
            JsonNode textNode = root.path("candidates").path(0)
                    .path("content").path("parts").path(0).path("text");
            if (textNode.isMissingNode() || !textNode.isTextual()) {
                log.warn("Gemini translate: unexpected response structure, skipping");
                return Map.of();
            }
            JsonNode translated = objectMapper.readTree(textNode.asText());
            Map<String, String> out = new LinkedHashMap<>();
            translated.fields().forEachRemaining(e -> {
                if (e.getValue() != null && e.getValue().isTextual()) {
                    out.put(e.getKey(), e.getValue().asText());
                }
            });
            return out;
        } catch (Exception e) {
            log.error("Gemini translate failed ({}): {}", e.getClass().getSimpleName(), e.getMessage());
            return Map.of();
        }
    }
}
