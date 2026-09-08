package com.bigbike.bigbike_backend.service.chat;

import static org.assertj.core.api.Assertions.assertThat;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

class ChatImageAnalysisClientTest {
    private final ObjectMapper mapper = new ObjectMapper();

    private String observation(int index) {
        return mapper.writeValueAsString(Map.of("imageIndex", index, "intent", "PRODUCT_SEARCH",
                "group", "Găng tay", "confidence", "HIGH", "brand", "UNKNOWN", "brandRole", "UNKNOWN",
                "brandConfidence", "LOW", "candidateSlugs", List.of(), "unsafe", false));
    }
    private String response(String finish, String json) {
        return mapper.writeValueAsString(Map.of("candidates", List.of(Map.of("finishReason", finish,
                "content", Map.of("parts", List.of(Map.of("thought", true, "text", "Do not parse this thought"),
                        Map.of("text", json.substring(0, json.length() / 2)), Map.of("text", json.substring(json.length() / 2))))))));
    }

    @Test void truncatedJsonIsRetriedAndAllNonThoughtTextPartsAreRead() {
        var calls = new AtomicInteger();
        var client = new ChatImageAnalysisClient("test-key", 65, mapper, (url, key, body, timeout) -> {
            assertThat(mapper.readTree(body).path("generationConfig").path("responseSchema").isObject()).isTrue();
            assertThat(timeout).isLessThanOrEqualTo(40_000);
            return calls.incrementAndGet() == 1 ? response("MAX_TOKENS", "{\"images\":[")
                    : response("STOP", "{\"images\":[" + observation(1) + "]}");
        }, 0);
        try (var budget = ChatTurnBudget.open(Instant.now().plusSeconds(65))) {
            var result = client.analyze(new byte[]{1}, "image/png", "Có sản phẩm này không", List.of(), List.of("Găng tay"));
            assertThat(result.analysis()).isPresent();
            assertThat(result.analysis().get().group()).isEqualTo("Găng tay");
            assertThat(result.providerRequests()).isEqualTo(2);
            assertThat(budget.providerCalls()).isEqualTo(2);
        }
    }

    @Test void malformedStopResponseRetriesButSafetyDoesNot() {
        var calls = new AtomicInteger();
        var client = new ChatImageAnalysisClient("test-key", 65, mapper, (url, key, body, timeout) -> {
            return calls.incrementAndGet() == 1 ? response("STOP", "{}")
                    : response("STOP", "{\"images\":[" + observation(1) + "]}");
        }, 0);
        assertThat(client.analyze(new byte[]{1}, "image/png", "", List.of(), List.of()).providerRequests()).isEqualTo(2);
        var blocked = new ChatImageAnalysisClient("test-key", 65, mapper,
                (url, key, body, timeout) -> response("SAFETY", "{}"), 0);
        var result = blocked.analyze(new byte[]{1}, "image/png", "", List.of(), List.of());
        assertThat(result.providerRequests()).isEqualTo(1);
        assertThat(result.analysis().orElseThrow().unsafe()).isTrue();
    }

    @Test void threeImagesShareOneProviderCallAndRequireEveryIndexedObservation() {
        var inputs = List.of(new ChatImageAnalysisClient.ImageInput(new byte[]{1}, "image/png"),
                new ChatImageAnalysisClient.ImageInput(new byte[]{2}, "image/jpeg"),
                new ChatImageAnalysisClient.ImageInput(new byte[]{3}, "image/webp"));
        var calls = new AtomicInteger();
        var client = new ChatImageAnalysisClient("test-key", 65, mapper, (url, key, body, timeout) -> {
            long count = mapper.readTree(body).path("contents").path(0).path("parts").valueStream()
                    .filter(part -> part.has("inlineData")).count();
            assertThat(count).isEqualTo(3);
            return response("STOP", "{\"images\":[" + observation(1) + "," + observation(2)
                    + (calls.incrementAndGet() == 1 ? "" : "," + observation(3)) + "]}");
        }, 0);
        var result = client.analyzeBatch(inputs, "Găng tay này", List.of(), List.of("Găng tay"));
        assertThat(result.analyses().orElseThrow()).hasSize(3);
        assertThat(result.providerRequests()).isEqualTo(2);
    }

    @Test void repeatedTechnicalFailureIsBoundedAndIsNotAnUnrecognizedImage() {
        var client = new ChatImageAnalysisClient("test-key", 65, mapper,
                (url, key, body, timeout) -> response("MAX_TOKENS", "{}"), 0);
        var result = client.analyze(new byte[]{1}, "image/png", "", List.of(), List.of());
        assertThat(result.analysis()).isEmpty();
        assertThat(result.providerRequests()).isEqualTo(4);
        assertThat(result.failureReason()).isNotBlank();
    }
}
