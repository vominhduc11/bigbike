package com.bigbike.bigbike_backend.service.review;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * Single outbound classification call to Google Gemini for one review
 * (REVIEW_RULE_012/013).
 *
 * <p>Follows the same shape the project already used for its previous Gemini integration
 * (the removed {@code GeminiTranslationService}): plain {@link RestClient}, self-contained
 * {@link ObjectMapper}, structured JSON response, and a hard rule that any failure is
 * survivable.
 *
 * <p>Deliberately minimal: no retries, no streaming, no conversation state. Every failure
 * path returns {@link Optional#empty()} so the caller leaves the review at {@code PENDING}
 * — an unavailable provider degrades the feature to manual moderation and can never block
 * a customer's review or approve one.
 *
 * <p>Only the comment text and star rating leave the system. Author name, email, photos,
 * customer id and order history are never sent (REVIEW_RULE_013).
 */
@Component
@Slf4j
public class AiReviewModerationClient {

    private static final String ENDPOINT =
            "https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent";

    private static final String DEFAULT_MODEL = "gemini-2.5-flash";

    /** Comments beyond this are truncated rather than rejected (REVIEW_RULE_013). */
    private static final int MAX_COMMENT_CHARS = 4000;

    /** The answer is three small fields; a larger budget would only fund a runaway reply. */
    private static final int MAX_OUTPUT_TOKENS = 512;

    private static final String SYSTEM_PROMPT = """
            You moderate Vietnamese customer reviews for a motorcycle gear shop \
            (helmets, jackets, gloves, accessories).

            Classify the review against these categories:
            - PROFANITY: swearing or crude language, including evasions such as missing \
            diacritics, inserted punctuation, or letter substitution.
            - HARASSMENT: insults or personal attacks on the shop, its staff or other \
            customers; discrimination by region, gender, appearance or similar.
            - ADVERTISING: promoting another seller, or embedding links, phone numbers, \
            Zalo/Telegram handles, or referral codes.
            - SENSITIVE: sexual content, politics, religion, or text with no relation to \
            the product.

            A negative, angry or one-star review is not by itself a violation. Harsh but \
            genuine criticism of the product, price, shipping or service is legitimate \
            feedback and must be reported as no violation. Report a category only when the \
            review actually contains that content, not when it might be read that way.

            Set "violation" to false and leave "categories" empty when nothing applies. \
            Write "reason" in Vietnamese, at most one short sentence naming what was found, \
            or an empty string when there is no violation.""";

    private final String apiKey;
    private final String model;
    private final RestClient restClient;
    // Self-contained mapper — this app does not expose an ObjectMapper bean for injection.
    private final ObjectMapper objectMapper = new ObjectMapper();

    public AiReviewModerationClient(
            @Value("${bigbike.review-moderation.gemini-api-key:}") String apiKey,
            @Value("${bigbike.review-moderation.model:gemini-2.5-flash}") String model,
            @Value("${bigbike.review-moderation.timeout-seconds:20}") long timeoutSeconds
    ) {
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.model = model == null || model.isBlank() ? DEFAULT_MODEL : model.trim();
        long seconds = timeoutSeconds > 0 ? timeoutSeconds : 20;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout((int) Duration.ofSeconds(5).toMillis());
        factory.setReadTimeout((int) Duration.ofSeconds(seconds).toMillis());
        this.restClient = RestClient.builder().requestFactory(factory).build();
        log.info("Review AI moderation client configured={} model={}", isConfigured(), this.model);
    }

    /** False when no credential is configured; the moderator then reports {@code SKIPPED}. */
    public boolean isConfigured() {
        return !apiKey.isEmpty();
    }

    /**
     * @return the model's verdict, or empty when the call could not be completed or its
     *         answer could not be trusted (network error, timeout, truncated or malformed
     *         response, safety block).
     */
    public Optional<AiVerdict> classify(String comment, BigDecimal rating) {
        if (!isConfigured() || comment == null || comment.isBlank()) {
            return Optional.empty();
        }
        try {
            String response = restClient.post()
                    .uri(String.format(ENDPOINT, model))
                    // Key travels as a header, not the `?key=` query parameter Google also
                    // accepts: a connect/read failure surfaces the request URI in the
                    // exception message, which would put the credential straight into the
                    // application log.
                    .header("x-goog-api-key", apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(buildRequestBody(comment, rating))
                    .retrieve()
                    .body(String.class);
            return parse(response);
        } catch (RuntimeException exception) {
            // Includes API errors, timeouts and transport failures. Logged without the
            // review body so an outage is visible in ops without leaking customer text.
            log.warn("Review AI moderation call failed ({}): {}",
                    exception.getClass().getSimpleName(), exception.getMessage());
            return Optional.empty();
        }
    }

    /** Request body, exposed package-private so its shape can be asserted without a network call. */
    Map<String, Object> buildRequestBody(String comment, BigDecimal rating) {
        String truncated = comment.length() > MAX_COMMENT_CHARS
                ? comment.substring(0, MAX_COMMENT_CHARS)
                : comment;
        String userMessage = "Số sao: " + (rating != null ? rating.toPlainString() : "không rõ")
                + "\nNội dung đánh giá:\n" + truncated;

        Map<String, Object> generationConfig = new LinkedHashMap<>();
        generationConfig.put("responseMimeType", "application/json");
        generationConfig.put("responseSchema", buildResponseSchema());
        generationConfig.put("maxOutputTokens", MAX_OUTPUT_TOKENS);
        // Classification does not need deliberation, and thinking tokens are billed as
        // output. Zero keeps the per-review cost at roughly the price of the prompt.
        generationConfig.put("thinkingConfig", Map.of("thinkingBudget", 0));

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("systemInstruction", Map.of("parts", List.of(Map.of("text", SYSTEM_PROMPT))));
        body.put("contents", List.of(Map.of(
                "role", "user",
                "parts", List.of(Map.of("text", userMessage)))));
        body.put("generationConfig", generationConfig);
        return body;
    }

    private static Map<String, Object> buildResponseSchema() {
        List<String> categoryNames = new ArrayList<>();
        for (ReviewModerationCategory category : ReviewModerationCategory.values()) {
            categoryNames.add(category.name());
        }

        Map<String, Object> properties = new LinkedHashMap<>();
        properties.put("violation", Map.of("type", "boolean"));
        properties.put("categories", Map.of(
                "type", "array",
                "items", Map.of("type", "string", "enum", categoryNames)));
        properties.put("reason", Map.of("type", "string"));

        Map<String, Object> schema = new LinkedHashMap<>();
        schema.put("type", "object");
        schema.put("properties", properties);
        schema.put("required", List.of("violation", "categories", "reason"));
        return schema;
    }

    private Optional<AiVerdict> parse(String response) {
        if (response == null || response.isBlank()) {
            return Optional.empty();
        }
        try {
            JsonNode root = objectMapper.readTree(response);
            JsonNode textNode = root.path("candidates").path(0)
                    .path("content").path("parts").path(0).path("text");
            if (textNode.isMissingNode() || !textNode.isTextual()) {
                // Also the shape returned when Gemini's own safety filter blocks the reply.
                // Treated as "could not classify", never as "the review is bad".
                log.warn("Review AI moderation: unexpected response structure, skipping");
                return Optional.empty();
            }

            JsonNode verdict = objectMapper.readTree(textNode.asText());
            boolean violation = verdict.path("violation").asBoolean(false);
            List<ReviewModerationCategory> categories = new ArrayList<>();
            for (JsonNode item : verdict.path("categories")) {
                ReviewModerationCategory.parse(item.asText())
                        .filter(category -> !categories.contains(category))
                        .ifPresent(categories::add);
            }
            String reason = verdict.path("reason").asText("");
            // A "violation" flag with no recognised category cannot be acted on: there is no
            // category to check against the shop's switches and no status to move to.
            if (violation && categories.isEmpty()) {
                return Optional.empty();
            }
            return Optional.of(new AiVerdict(violation, List.copyOf(categories), reason));
        } catch (Exception exception) {
            log.warn("Review AI moderation returned an unparseable payload: {}",
                    exception.getMessage());
            return Optional.empty();
        }
    }

    /** Raw model answer, before the shop's category switches are applied. */
    public record AiVerdict(
            boolean violation,
            List<ReviewModerationCategory> categories,
            String reason
    ) {}
}
