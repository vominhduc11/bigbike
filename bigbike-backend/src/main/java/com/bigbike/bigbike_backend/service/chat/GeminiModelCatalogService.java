package com.bigbike.bigbike_backend.service.chat;

import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatModelCatalogResponse;
import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatModelResponse;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

/** Live account discovery intersected with the effective-dated, officially priced registry. */
@Service
@Slf4j
public class GeminiModelCatalogService {

    private static final String MODELS_ENDPOINT =
            "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000";
    private static final ZoneId VN_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private final String apiKey;
    private final String fallbackModel;
    private final String reviewModerationModel;
    private final Duration cacheDuration;
    private final ChatAssistantSettings assistantSettings;
    private final ChatModelRegistry registry;
    private final Supplier<String> modelsPayload;
    private final ObjectMapper objectMapper;
    private final Clock clock;
    private volatile LiveSnapshot cached;

    @Autowired
    public GeminiModelCatalogService(
            @Value("${bigbike.ai.gemini-api-key:}") String apiKey,
            @Value("${bigbike.chat.fallback-model:gemini-2.5-flash-lite}") String fallbackModel,
            @Value("${bigbike.review-moderation.model:gemini-2.5-flash}") String reviewModerationModel,
            @Value("${bigbike.chat.model-catalog-cache-minutes:15}") long cacheMinutes,
            ChatAssistantSettings assistantSettings,
            ChatModelRegistry registry,
            ObjectMapper objectMapper
    ) {
        this(apiKey, fallbackModel, reviewModerationModel, cacheMinutes, assistantSettings,
                registry, buildPayloadSupplier(apiKey), objectMapper, Clock.systemUTC());
    }

    GeminiModelCatalogService(
            String apiKey,
            String fallbackModel,
            String reviewModerationModel,
            long cacheMinutes,
            ChatAssistantSettings assistantSettings,
            ChatModelRegistry registry,
            Supplier<String> modelsPayload,
            ObjectMapper objectMapper,
            Clock clock
    ) {
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.fallbackModel = cleanModel(fallbackModel, "gemini-2.5-flash-lite");
        this.reviewModerationModel = cleanModel(reviewModerationModel, "gemini-2.5-flash");
        this.cacheDuration = Duration.ofMinutes(Math.max(1, Math.min(cacheMinutes, 1440)));
        this.assistantSettings = assistantSettings;
        this.registry = registry;
        this.modelsPayload = modelsPayload;
        this.objectMapper = objectMapper;
        this.clock = clock;
    }

    public AdminChatModelCatalogResponse catalog(boolean forceRefresh) {
        LiveSnapshot live = live(forceRefresh);
        LocalDate today = LocalDate.ofInstant(clock.instant(), VN_ZONE);
        List<AdminChatModelResponse> models = registry.active(today).stream()
                .map(price -> toResponse(price, live.availableModelIds(), live.success()))
                .toList();
        return new AdminChatModelCatalogResponse(
                assistantSettings.currentModel(),
                fallbackModel,
                reviewModerationModel,
                models,
                live.refreshedAt(),
                !live.success());
    }

    public boolean isSelectable(String modelId, boolean forceRefresh) {
        String clean = cleanModel(modelId, "");
        if (clean.isBlank()) return false;
        LocalDate today = LocalDate.ofInstant(clock.instant(), VN_ZONE);
        return registry.price(clean, today).isPresent()
                && live(forceRefresh).availableModelIds().contains(clean);
    }

    public String fallbackModel() {
        return fallbackModel;
    }

    public ChatModelRegistry.ModelPrice requirePrice(String modelId, Instant at) {
        LocalDate date = LocalDate.ofInstant(at == null ? clock.instant() : at, VN_ZONE);
        return registry.price(cleanModel(modelId, ""), date)
                .orElseThrow(() -> new IllegalStateException(
                        "No effective Gemini price configured for requested model"));
    }

    private LiveSnapshot live(boolean forceRefresh) {
        Instant now = clock.instant();
        LiveSnapshot current = cached;
        if (!forceRefresh && current != null
                && current.refreshedAt().plus(cacheDuration).isAfter(now)) {
            return current;
        }
        synchronized (this) {
            current = cached;
            if (!forceRefresh && current != null
                    && current.refreshedAt().plus(cacheDuration).isAfter(now)) {
                return current;
            }
            try {
                if (apiKey.isBlank()) throw new IllegalStateException("Gemini API key is not configured");
                Set<String> ids = parseAvailableModelIds(modelsPayload.get());
                LiveSnapshot refreshed = new LiveSnapshot(Set.copyOf(ids), now, true);
                cached = refreshed;
                return refreshed;
            } catch (RuntimeException exception) {
                log.warn("chat_model_discovery_failed type={}", exception.getClass().getSimpleName());
                if (current != null) {
                    LiveSnapshot stale = new LiveSnapshot(
                            current.availableModelIds(), current.refreshedAt(), false);
                    cached = stale;
                    return stale;
                }
                LiveSnapshot failed = new LiveSnapshot(Set.of(), now, false);
                cached = failed;
                return failed;
            }
        }
    }

    private Set<String> parseAvailableModelIds(String payload) {
        try {
            JsonNode models = objectMapper.readTree(payload).path("models");
            if (!models.isArray()) throw new IllegalStateException("Gemini models payload is invalid");
            Set<String> result = new LinkedHashSet<>();
            for (JsonNode model : models) {
                String id = cleanModel(model.path("name").asText(""), "");
                if (!isStableGeneralModel(id)) continue;
                boolean generateContent = false;
                for (JsonNode method : model.path("supportedGenerationMethods")) {
                    if ("generateContent".equals(method.asText())) {
                        generateContent = true;
                        break;
                    }
                }
                if (generateContent) result.add(id);
            }
            return result;
        } catch (RuntimeException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new IllegalStateException("Gemini models payload is invalid", exception);
        }
    }

    private static AdminChatModelResponse toResponse(
            ChatModelRegistry.ModelPrice price,
            Set<String> available,
            boolean discoverySucceeded
    ) {
        boolean accountAvailable = available.contains(price.modelId());
        boolean selectable = discoverySucceeded && accountAvailable;
        String reason = selectable ? null
                : discoverySucceeded ? "NOT_AVAILABLE_FOR_ACCOUNT" : "ACCOUNT_CHECK_UNAVAILABLE";
        return new AdminChatModelResponse(
                price.modelId(), price.displayName(), price.speedTier(), price.costTier(),
                price.speedDescriptionVi(), price.speedDescriptionEn(),
                price.costDescriptionVi(), price.costDescriptionEn(),
                price.inputUsdPerMillion(), price.outputUsdPerMillion(), price.supportsImages(),
                accountAvailable, selectable, reason, price.effectiveFrom(), price.pricingSource());
    }

    private static boolean isStableGeneralModel(String id) {
        return id.matches("gemini-[0-9]+(?:\\.[0-9]+)*-(?:flash|flash-lite|pro)")
                && !id.contains("preview")
                && !id.contains("exp")
                && !id.contains("latest");
    }

    private static String cleanModel(String value, String fallback) {
        if (value == null || value.isBlank()) return fallback;
        String clean = value.trim();
        return clean.startsWith("models/") ? clean.substring("models/".length()) : clean;
    }

    private static Supplier<String> buildPayloadSupplier(String apiKey) {
        String safeKey = apiKey == null ? "" : apiKey.trim();
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout((int) Duration.ofSeconds(5).toMillis());
        factory.setReadTimeout((int) Duration.ofSeconds(15).toMillis());
        RestClient client = RestClient.builder().requestFactory(factory).build();
        return () -> client.get()
                .uri(MODELS_ENDPOINT)
                .header("x-goog-api-key", safeKey)
                .accept(MediaType.APPLICATION_JSON)
                .retrieve()
                .body(String.class);
    }

    private record LiveSnapshot(Set<String> availableModelIds, Instant refreshedAt, boolean success) {}
}
