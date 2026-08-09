package com.bigbike.bigbike_backend.service.chat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
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

/** One fail-safe Gemini answer for Bi. Customer text and tool data are never logged. */
@Component
@Slf4j
public class AiChatClient {

    private static final String ENDPOINT =
            "https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent";
    private static final String DEFAULT_MODEL = "gemini-2.5-flash";
    private static final int MAX_QUESTION_CHARS = 1000;
    private static final int MAX_TOOL_CHARS = 12_000;
    private static final int MAX_OUTPUT_TOKENS = 400;

    private static final String SYSTEM_PROMPT = """
            You are Bi, BigBike's AI sales assistant. Reply in the requested language.
            In Vietnamese, call yourself "em" and the customer "anh/chị".

            Use ONLY facts in TOOL_RESULT. Never invent price, stock, size, weight,
            delivery timing, warranty, returns, discounts or product specifications.
            If TOOL_RESULT lacks a requested fact, say BigBike has not provided it and
            recommend speaking to staff. Do not advise about motorcycles, politics or
            anything outside products currently sold by BigBike and published shop policies.
            Do not promise a discount or delivery date, approve an exception, or place an
            order. Keep the answer to 3-5 short sentences. Product cards are rendered by the
            application, so mention at most three products and do not output URLs.

            Set offTopic=true only when the request is outside scope. Set handoffRecommended
            for complaints, complex warranty cases or price negotiation. Set leadPrompt=true
            only when the customer is still considering a purchase and a staff callback would
            genuinely help; the application ensures this invitation is shown at most once.
            """;

    private final String apiKey;
    private final String model;
    private final RestClient restClient;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public AiChatClient(
            @Value("${bigbike.ai.gemini-api-key:}") String apiKey,
            @Value("${bigbike.chat.model:gemini-2.5-flash}") String model,
            @Value("${bigbike.chat.timeout-seconds:20}") long timeoutSeconds
    ) {
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.model = model == null || model.isBlank() ? DEFAULT_MODEL : model.trim();
        long seconds = timeoutSeconds > 0 ? timeoutSeconds : 20;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout((int) Duration.ofSeconds(5).toMillis());
        factory.setReadTimeout((int) Duration.ofSeconds(seconds).toMillis());
        this.restClient = RestClient.builder().requestFactory(factory).build();
        log.info("Bi AI client configured={} model={}", isConfigured(), this.model);
    }

    public boolean isConfigured() {
        return !apiKey.isEmpty();
    }

    public Optional<Answer> answer(String question, String toolResultJson, String lang) {
        if (!isConfigured() || question == null || question.isBlank()) return Optional.empty();
        try {
            String response = restClient.post()
                    .uri(String.format(ENDPOINT, model))
                    .header("x-goog-api-key", apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(buildRequestBody(question, toolResultJson, lang))
                    .retrieve()
                    .body(String.class);
            return parse(response);
        } catch (RuntimeException exception) {
            log.warn("Bi AI call failed ({})", exception.getClass().getSimpleName());
            return Optional.empty();
        }
    }

    Map<String, Object> buildRequestBody(String question, String toolResultJson, String lang) {
        String safeQuestion = truncate(question, MAX_QUESTION_CHARS);
        String safeTool = truncate(toolResultJson == null ? "{}" : toolResultJson, MAX_TOOL_CHARS);
        String userMessage = "LANG=" + ("en".equals(lang) ? "en" : "vi")
                + "\nQUESTION:\n" + safeQuestion
                + "\nTOOL_RESULT:\n" + safeTool;

        Map<String, Object> generation = new LinkedHashMap<>();
        generation.put("responseMimeType", "application/json");
        generation.put("responseSchema", responseSchema());
        generation.put("maxOutputTokens", MAX_OUTPUT_TOKENS);
        generation.put("thinkingConfig", Map.of("thinkingBudget", 0));

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("systemInstruction", Map.of("parts", List.of(Map.of("text", SYSTEM_PROMPT))));
        body.put("contents", List.of(Map.of(
                "role", "user",
                "parts", List.of(Map.of("text", userMessage)))));
        body.put("generationConfig", generation);
        return body;
    }

    private static Map<String, Object> responseSchema() {
        return Map.of(
                "type", "object",
                "properties", Map.of(
                        "answer", Map.of("type", "string"),
                        "offTopic", Map.of("type", "boolean"),
                        "handoffRecommended", Map.of("type", "boolean"),
                        "leadPrompt", Map.of("type", "boolean")),
                "required", List.of("answer", "offTopic", "handoffRecommended", "leadPrompt"));
    }

    private Optional<Answer> parse(String response) {
        if (response == null || response.isBlank()) return Optional.empty();
        try {
            JsonNode textNode = objectMapper.readTree(response)
                    .path("candidates").path(0).path("content").path("parts").path(0).path("text");
            if (!textNode.isTextual()) return Optional.empty();
            JsonNode answer = objectMapper.readTree(textNode.asText());
            String content = answer.path("answer").asText("").trim();
            if (content.isEmpty()) return Optional.empty();
            return Optional.of(new Answer(
                    content,
                    answer.path("offTopic").asBoolean(false),
                    answer.path("handoffRecommended").asBoolean(false),
                    answer.path("leadPrompt").asBoolean(false)));
        } catch (Exception exception) {
            log.warn("Bi AI returned an unparseable payload");
            return Optional.empty();
        }
    }

    private static String truncate(String value, int max) {
        return value.length() <= max ? value : value.substring(0, max);
    }

    public record Answer(
            String answer,
            boolean offTopic,
            boolean handoffRecommended,
            boolean leadPrompt
    ) {}
}
