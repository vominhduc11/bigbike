package com.bigbike.bigbike_backend.service.chat;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

/**
 * One bounded multimodal recognition turn. It uses the same fixed Gemini model as text chat;
 * a transient provider fault is retried on that model only.
 */
@Component
@Slf4j
public class ChatImageAnalysisClient {

    private static final String ENDPOINT =
            "https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent";
    private static final int MAX_PROVIDER_CALLS = 4;
    private static final long LOGICAL_DEADLINE_NANOS = Duration.ofSeconds(65).toNanos();
    private static final long RETRY_DELAY_MILLIS = 1_500L;
    private static final String SYSTEM_PROMPT = """
            You classify one customer image for BigBike, a motorcycle gear shop. Do not identify
            a person, infer health/body measurements, read an order number, invoice value, price,
            specification, address, phone, email or other text as a shop fact. Never claim an item
            is the same product as a catalog item. Return JSON only.

            intent must be exactly one of PRODUCT_SEARCH, DAMAGED_PRODUCT, ORDER_DOCUMENT,
            SIZE_FROM_PERSON, UNRELATED, UNKNOWN. Mark DAMAGED_PRODUCT for visible breakage or a
            complaint about damage. Mark ORDER_DOCUMENT for receipts, invoices, labels or order
            screenshots. Mark SIZE_FROM_PERSON for a head/person/body image used to ask fit or size.
            Mark UNRELATED when outside motorcycle products, protective gear, orders and shop help.
            Mark unsafe=true for sexual, graphic, hateful or otherwise inappropriate imagery.

            candidateSlugs may contain at most three values copied verbatim from PUBLIC_CATALOG.
            Choose a slug only when visible shape, branding or model markings give meaningful
            similarity. It is acceptable and preferred to return no candidate. group must be one
            value copied verbatim from PUBLIC_GROUPS, or UNKNOWN. confidence is HIGH, MEDIUM or LOW.
            Do not output any observed text, price, number, identity or explanation.
            """;

    private final String apiKey;
    private final long configuredTimeoutMillis;
    private final ObjectMapper objectMapper;

    public ChatImageAnalysisClient(
            @Value("${bigbike.ai.gemini-api-key:}") String apiKey,
            @Value("${bigbike.chat.timeout-seconds:65}") long timeoutSeconds,
            ObjectMapper objectMapper
    ) {
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.configuredTimeoutMillis = Duration.ofSeconds(
                Math.max(5, Math.min(timeoutSeconds, 65))).toMillis();
        this.objectMapper = objectMapper;
    }

    public AnalysisCall analyze(
            byte[] image,
            String mimeType,
            String caption,
            List<CatalogCandidate> candidates,
            List<String> groups
    ) {
        if (apiKey.isBlank()) return AnalysisCall.unavailable();
        long startedAtNanos = System.nanoTime();
        String failure = null;
        for (int attempt = 1; attempt <= MAX_PROVIDER_CALLS; attempt++) {
            long remainingMillis = remainingMillis(startedAtNanos);
            if (remainingMillis <= 0) break;
            try {
                return new AnalysisCall(
                        Optional.of(call(remainingMillis, image, mimeType, caption, candidates, groups)),
                        attempt,
                        null);
            } catch (UnsafeImageException exception) {
                return new AnalysisCall(Optional.of(ImageAnalysis.blocked()), attempt, "SAFETY");
            } catch (RuntimeException exception) {
                failure = failureCode(exception);
                log.warn("chat_image_analysis_failed model={} type={}",
                        AiChatClient.FIXED_MODEL, exception.getClass().getSimpleName());
                if (attempt >= MAX_PROVIDER_CALLS || !isTransientProviderFailure(exception)
                        || !sleepBeforeRetry(startedAtNanos)) {
                    break;
                }
            }
        }
        return new AnalysisCall(Optional.empty(), 0, failure == null ? "TIMEOUT" : failure);
    }

    private ImageAnalysis call(
            long remainingMillis,
            byte[] image,
            String mimeType,
            String caption,
            List<CatalogCandidate> candidates,
            List<String> groups
    ) {
        try {
            String safeCaption = ChatHistorySanitizer.sanitize(caption == null ? "" : caption);
            if (safeCaption.length() > 1000) safeCaption = safeCaption.substring(0, 1000);
            String context = objectMapper.writeValueAsString(Map.of(
                    "CUSTOMER_CAPTION", safeCaption,
                    "PUBLIC_GROUPS", groups == null ? List.of() : groups.stream().limit(100).toList(),
                    "PUBLIC_CATALOG", candidates == null ? List.of() : candidates.stream().limit(250).toList()));
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("systemInstruction", Map.of("parts", List.of(Map.of("text", SYSTEM_PROMPT))));
            body.put("contents", List.of(Map.of(
                    "role", "user",
                    "parts", List.of(
                            Map.of("text", context),
                            Map.of("inlineData", Map.of(
                                    "mimeType", mimeType,
                                    "data", Base64.getEncoder().encodeToString(image)))))));
            body.put("generationConfig", Map.of(
                    "temperature", 0,
                    "maxOutputTokens", 512,
                    "responseMimeType", "application/json"));
            body.put("safetySettings", List.of(
                    safety("HARM_CATEGORY_HARASSMENT"),
                    safety("HARM_CATEGORY_HATE_SPEECH"),
                    safety("HARM_CATEGORY_SEXUALLY_EXPLICIT"),
                    safety("HARM_CATEGORY_DANGEROUS_CONTENT")));
            String payload = restClient(Math.min(configuredTimeoutMillis, remainingMillis)).post()
                    .uri(ENDPOINT.formatted(AiChatClient.FIXED_MODEL))
                    .header("x-goog-api-key", apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .accept(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(String.class);
            JsonNode root = objectMapper.readTree(payload);
            if (isSafetyBlocked(root)) throw new UnsafeImageException();
            String text = root.path("candidates").path(0).path("content")
                    .path("parts").path(0).path("text").asText("");
            ImageAnalysis analysis = parseAnalysis(text);
            if (analysis.unsafe()) throw new UnsafeImageException();
            return analysis;
        } catch (UnsafeImageException exception) {
            throw exception;
        } catch (RuntimeException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new IllegalStateException("Invalid image analysis response", exception);
        }
    }

    private ImageAnalysis parseAnalysis(String raw) throws Exception {
        String value = raw == null ? "" : raw.trim();
        if (value.startsWith("```")) {
            value = value.replaceFirst("^```(?:json)?\\s*", "")
                    .replaceFirst("\\s*```$", "").trim();
        }
        JsonNode json = objectMapper.readTree(value);
        String intent = json.path("intent").asText("UNKNOWN").trim().toUpperCase();
        if (!List.of("PRODUCT_SEARCH", "DAMAGED_PRODUCT", "ORDER_DOCUMENT",
                "SIZE_FROM_PERSON", "UNRELATED", "UNKNOWN").contains(intent)) {
            intent = "UNKNOWN";
        }
        String confidence = json.path("confidence").asText("LOW").trim().toUpperCase();
        if (!List.of("HIGH", "MEDIUM", "LOW").contains(confidence)) confidence = "LOW";
        String group = cleanText(json.path("group").asText("UNKNOWN"), 120);
        List<String> slugs = new ArrayList<>();
        for (JsonNode item : json.path("candidateSlugs")) {
            String slug = item.asText("").trim();
            if (slug.matches("[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*") && !slugs.contains(slug)) {
                slugs.add(slug);
            }
            if (slugs.size() >= 3) break;
        }
        return new ImageAnalysis(intent, group, confidence, List.copyOf(slugs),
                json.path("unsafe").asBoolean(false));
    }

    private static Map<String, String> safety(String category) {
        return Map.of("category", category, "threshold", "BLOCK_MEDIUM_AND_ABOVE");
    }

    private static RestClient restClient(long readTimeoutMillis) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout((int) Math.min(Duration.ofSeconds(5).toMillis(), readTimeoutMillis));
        factory.setReadTimeout((int) Math.max(250L, readTimeoutMillis));
        return RestClient.builder().requestFactory(factory).build();
    }

    private static boolean isSafetyBlocked(JsonNode root) {
        String block = root.path("promptFeedback").path("blockReason").asText("");
        if ("SAFETY".equalsIgnoreCase(block)) return true;
        for (JsonNode candidate : root.path("candidates")) {
            if ("SAFETY".equalsIgnoreCase(candidate.path("finishReason").asText(""))) return true;
        }
        return false;
    }

    private static boolean isTransientProviderFailure(RuntimeException exception) {
        if (exception instanceof ResourceAccessException) return true;
        if (exception instanceof RestClientResponseException provider) {
            int status = provider.getStatusCode().value();
            return status == 429 || status >= 500;
        }
        return false;
    }

    private static String failureCode(RuntimeException exception) {
        if (exception instanceof ResourceAccessException) return "NETWORK";
        if (exception instanceof RestClientResponseException provider) {
            int status = provider.getStatusCode().value();
            if (status == 429) return "RATE_LIMIT";
            if (status >= 500) return "PROVIDER_5XX";
        }
        return "INVALID_RESPONSE";
    }

    private static long remainingMillis(long startedAtNanos) {
        long remaining = LOGICAL_DEADLINE_NANOS - (System.nanoTime() - startedAtNanos);
        return Duration.ofNanos(Math.max(0L, remaining)).toMillis();
    }

    private static boolean sleepBeforeRetry(long startedAtNanos) {
        if (remainingMillis(startedAtNanos) <= RETRY_DELAY_MILLIS) return false;
        try {
            Thread.sleep(RETRY_DELAY_MILLIS);
            return true;
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            return false;
        }
    }

    private static String cleanText(String value, int max) {
        String clean = value == null ? "" : value.replaceAll("[\\p{Cntrl}]", " ").trim();
        return clean.length() <= max ? clean : clean.substring(0, max);
    }

    public record CatalogCandidate(String slug, String name, String group, String brand) {}

    public record ImageAnalysis(
            String intent,
            String group,
            String confidence,
            List<String> candidateSlugs,
            boolean unsafe
    ) {
        static ImageAnalysis blocked() {
            return new ImageAnalysis("UNKNOWN", "UNKNOWN", "LOW", List.of(), true);
        }
    }

    public record AnalysisCall(
            Optional<ImageAnalysis> analysis,
            int providerRequests,
            String failureReason
    ) {
        public AnalysisCall {
            analysis = analysis == null ? Optional.empty() : analysis;
            providerRequests = Math.max(0, providerRequests);
        }

        static AnalysisCall unavailable() {
            return new AnalysisCall(Optional.empty(), 0, "NOT_CONFIGURED");
        }
    }

    private static final class UnsafeImageException extends RuntimeException {}
}
