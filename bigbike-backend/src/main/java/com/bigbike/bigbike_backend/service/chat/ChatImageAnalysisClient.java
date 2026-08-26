package com.bigbike.bigbike_backend.service.chat;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
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
import org.springframework.web.client.RestClient;

/** One bounded multimodal classification call. Customer image bytes and captions are never logged. */
@Component
@Slf4j
public class ChatImageAnalysisClient {

    private static final String ENDPOINT =
            "https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent";
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
    private final String fallbackModel;
    private final RestClient primaryRestClient;
    private final RestClient fallbackRestClient;
    private final ObjectMapper objectMapper;
    private final GeminiModelCatalogService modelCatalogService;

    public ChatImageAnalysisClient(
            @Value("${bigbike.ai.gemini-api-key:}") String apiKey,
            @Value("${bigbike.chat.fallback-model:gemini-2.5-flash-lite}") String fallbackModel,
            @Value("${bigbike.chat.primary-timeout-seconds:35}") long primaryTimeoutSeconds,
            @Value("${bigbike.chat.timeout-seconds:65}") long totalTimeoutSeconds,
            ObjectMapper objectMapper,
            GeminiModelCatalogService modelCatalogService
    ) {
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.fallbackModel = fallbackModel == null || fallbackModel.isBlank()
                ? "gemini-2.5-flash-lite" : fallbackModel.trim();
        long primarySeconds = Math.max(5, Math.min(primaryTimeoutSeconds, 60));
        long totalSeconds = Math.max(primarySeconds + 5, Math.min(totalTimeoutSeconds, 70));
        this.primaryRestClient = restClient(primarySeconds);
        this.fallbackRestClient = restClient(Math.max(5, totalSeconds - primarySeconds));
        this.objectMapper = objectMapper;
        this.modelCatalogService = modelCatalogService;
    }

    public AnalysisCall analyze(
            String requestedModel,
            byte[] image,
            String mimeType,
            String caption,
            List<CatalogCandidate> candidates,
            List<String> groups
    ) {
        if (apiKey.isBlank()) return AnalysisCall.unavailable(requestedModel);
        long started = System.nanoTime();
        List<String> models = new ArrayList<>();
        models.add(cleanModel(requestedModel));
        if (!fallbackModel.equals(models.get(0))) models.add(fallbackModel);
        String failure = null;
        List<ModelUsage> modelUsages = new ArrayList<>();
        for (int index = 0; index < models.size(); index++) {
            String model = models.get(index);
            try {
                ProviderResult result = call(
                        index == 0 ? primaryRestClient : fallbackRestClient,
                        model, image, mimeType, caption, candidates, groups);
                modelUsages.add(modelUsage(model, result.usage(), index > 0, true));
                int latency = elapsedMillis(started);
                return new AnalysisCall(
                        Optional.of(result.analysis()), models.get(0), model, index > 0,
                        modelUsages.size(), totalUsage(modelUsages), totalCost(modelUsages),
                        modelCatalogService.requirePrice(model, Instant.now()).effectiveFrom(),
                        latency, null, modelUsages);
            } catch (UnsafeImageException exception) {
                modelUsages.add(modelUsage(model, exception.usage(), index > 0, true));
                return new AnalysisCall(
                        Optional.of(ImageAnalysis.blocked()), models.get(0), model, index > 0,
                        modelUsages.size(), totalUsage(modelUsages), totalCost(modelUsages),
                        modelCatalogService.requirePrice(model, Instant.now()).effectiveFrom(),
                        elapsedMillis(started), "SAFETY", modelUsages);
            } catch (RuntimeException exception) {
                failure = exception.getClass().getSimpleName();
                // A timeout or provider error may not include usage metadata. Count the attempt,
                // but record zero tokens/cost rather than inventing a billable amount.
                modelUsages.add(modelUsage(model, TokenUsage.ZERO, index > 0, false));
                log.warn("chat_image_analysis_failed model={} type={}", model, failure);
            }
        }
        return new AnalysisCall(
                Optional.empty(), models.get(0), models.get(models.size() - 1), models.size() > 1,
                modelUsages.size(), totalUsage(modelUsages), totalCost(modelUsages),
                modelCatalogService.requirePrice(models.get(models.size() - 1), Instant.now()).effectiveFrom(),
                elapsedMillis(started), failure, modelUsages);
    }

    private ModelUsage modelUsage(
            String model,
            TokenUsage usage,
            boolean fallback,
            boolean success
    ) {
        var price = modelCatalogService.requirePrice(model, Instant.now());
        return new ModelUsage(model, 1, usage, estimateCost(model, usage),
                price.effectiveFrom(), fallback, success);
    }

    private static TokenUsage totalUsage(List<ModelUsage> modelUsages) {
        return new TokenUsage(
                modelUsages.stream().mapToInt(item -> item.usage().inputTokens()).sum(),
                modelUsages.stream().mapToInt(item -> item.usage().outputTokens()).sum(),
                modelUsages.stream().mapToInt(item -> item.usage().thinkingTokens()).sum());
    }

    private static BigDecimal totalCost(List<ModelUsage> modelUsages) {
        return modelUsages.stream()
                .map(ModelUsage::estimatedCostUsd)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private ProviderResult call(
            RestClient client,
            String model,
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
            body.put("systemInstruction", Map.of(
                    "parts", List.of(Map.of("text", SYSTEM_PROMPT))));
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
            String payload = client.post()
                    .uri(ENDPOINT.formatted(model))
                    .header("x-goog-api-key", apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .accept(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(String.class);
            JsonNode root = objectMapper.readTree(payload);
            TokenUsage usage = usage(root.path("usageMetadata"));
            if (isSafetyBlocked(root)) throw new UnsafeImageException(usage);
            String text = root.path("candidates").path(0).path("content")
                    .path("parts").path(0).path("text").asText("");
            ImageAnalysis analysis = parseAnalysis(text);
            if (analysis.unsafe()) throw new UnsafeImageException(usage);
            return new ProviderResult(analysis, usage);
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

    private BigDecimal estimateCost(String model, TokenUsage usage) {
        var price = modelCatalogService.requirePrice(model, Instant.now());
        BigDecimal input = price.inputUsdPerMillion()
                .multiply(BigDecimal.valueOf(usage.inputTokens()));
        BigDecimal output = price.outputUsdPerMillion()
                .multiply(BigDecimal.valueOf((long) usage.outputTokens() + usage.thinkingTokens()));
        return input.add(output).divide(BigDecimal.valueOf(1_000_000L), 8, RoundingMode.HALF_UP);
    }

    private static Map<String, String> safety(String category) {
        return Map.of("category", category, "threshold", "BLOCK_MEDIUM_AND_ABOVE");
    }

    private static RestClient restClient(long readTimeoutSeconds) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout((int) Duration.ofSeconds(5).toMillis());
        factory.setReadTimeout((int) Duration.ofSeconds(readTimeoutSeconds).toMillis());
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

    private static TokenUsage usage(JsonNode node) {
        return new TokenUsage(
                Math.max(0, node.path("promptTokenCount").asInt(0)),
                Math.max(0, node.path("candidatesTokenCount").asInt(0)),
                Math.max(0, node.path("thoughtsTokenCount").asInt(0)));
    }

    private static String cleanModel(String value) {
        if (value == null || value.isBlank()) return "gemini-2.5-flash";
        String clean = value.trim();
        return clean.startsWith("models/") ? clean.substring(7) : clean;
    }

    private static String cleanText(String value, int max) {
        String clean = value == null ? "" : value.replaceAll("[\\p{Cntrl}]", " ").trim();
        return clean.length() <= max ? clean : clean.substring(0, max);
    }

    private static int elapsedMillis(long started) {
        return (int) Math.min(Integer.MAX_VALUE,
                Math.max(0L, (System.nanoTime() - started) / 1_000_000L));
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

    public record TokenUsage(int inputTokens, int outputTokens, int thinkingTokens) {
        private static final TokenUsage ZERO = new TokenUsage(0, 0, 0);
    }

    public record ModelUsage(
            String modelId,
            int providerRequests,
            TokenUsage usage,
            BigDecimal estimatedCostUsd,
            java.time.LocalDate priceEffectiveFrom,
            boolean fallback,
            boolean success
    ) {}

    public record AnalysisCall(
            Optional<ImageAnalysis> analysis,
            String requestedModel,
            String servedModel,
            boolean fallback,
            int providerRequests,
            TokenUsage usage,
            BigDecimal estimatedCostUsd,
            java.time.LocalDate priceEffectiveFrom,
            int latencyMs,
            String failureReason,
            List<ModelUsage> modelUsages
    ) {
        public AnalysisCall {
            analysis = analysis == null ? Optional.empty() : analysis;
            usage = usage == null ? TokenUsage.ZERO : usage;
            estimatedCostUsd = estimatedCostUsd == null ? BigDecimal.ZERO : estimatedCostUsd;
            modelUsages = modelUsages == null ? List.of() : List.copyOf(modelUsages);
        }

        public AnalysisCall(
                Optional<ImageAnalysis> analysis,
                String requestedModel,
                String servedModel,
                boolean fallback,
                int providerRequests,
                TokenUsage usage,
                BigDecimal estimatedCostUsd,
                java.time.LocalDate priceEffectiveFrom,
                int latencyMs,
                String failureReason
        ) {
            this(analysis, requestedModel, servedModel, fallback, providerRequests, usage,
                    estimatedCostUsd, priceEffectiveFrom, latencyMs, failureReason, List.of());
        }

        static AnalysisCall unavailable(String model) {
            String clean = cleanModel(model);
            return new AnalysisCall(Optional.empty(), clean, clean, false, 0, TokenUsage.ZERO,
                    BigDecimal.ZERO, null, 0, "NOT_CONFIGURED", List.of());
        }
    }

    private record ProviderResult(ImageAnalysis analysis, TokenUsage usage) {}

    private static final class UnsafeImageException extends RuntimeException {
        private final TokenUsage usage;
        private UnsafeImageException(TokenUsage usage) { this.usage = usage; }
        private TokenUsage usage() { return usage; }
    }
}
