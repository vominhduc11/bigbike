package com.bigbike.bigbike_backend.service.chat;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class AiChatRequestShapeTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private static AiChatClient client() {
        return new AiChatClient("test-key", "gemini-2.5-flash", 20L);
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> generation(Map<String, Object> body) {
        return (Map<String, Object>) body.get("generationConfig");
    }

    @Test
    @DisplayName("Bi disables thinking, caps output and sends fixed function declarations")
    void pinsCostControls() {
        Map<String, Object> body = client().buildInitialRequestBody(
                "Tìm mũ 3/4 dưới 2 triệu.", "vi", new ChatToolRegistry());
        Map<String, Object> config = generation(body);

        assertThat(config.get("thinkingConfig")).isEqualTo(Map.of("thinkingBudget", 0));
        assertThat(config.get("maxOutputTokens")).isEqualTo(400);
        assertThat(config).doesNotContainKey("responseMimeType");
        assertThat(MAPPER.valueToTree(body).path("tools").toString())
                .contains("search_products", "get_product", "get_policy", "get_shop_info", "get_my_orders")
                .doesNotContain("capture_lead", "additionalProperties", "parametersJsonSchema");
    }

    @Test
    @DisplayName("initial request uses only the Generate Content fields needed by Bi")
    @SuppressWarnings("unchecked")
    void usesSupportedGenerateContentRequestFields() {
        Map<String, Object> body = client().buildInitialRequestBody(
                "Tìm mũ 3/4 dưới 2 triệu.", "vi", new ChatToolRegistry());

        assertThat(body).containsOnlyKeys(
                "systemInstruction", "contents", "generationConfig", "tools", "toolConfig");
        assertThat((Map<String, Object>) body.get("generationConfig"))
                .containsOnlyKeys("maxOutputTokens", "thinkingConfig");
        assertThat((Map<String, Object>) body.get("toolConfig"))
                .containsOnlyKeys("functionCallingConfig");
        assertThat((Map<String, Object>) ((Map<String, Object>) body.get("toolConfig"))
                .get("functionCallingConfig"))
                .containsOnlyKeys("mode");
        assertThat(MAPPER.valueToTree(body).path("toolConfig").path("functionCallingConfig")
                .path("mode").asText()).isEqualTo("ANY");
    }

    @Test
    @DisplayName("initial request carries only the current question and fixed declarations")
    void sendsOnlyCurrentQuestion() throws Exception {
        Map<String, Object> body = client().buildInitialRequestBody(
                "Tìm mũ 3/4 dưới 2 triệu.", "vi", new ChatToolRegistry());

        assertThat((List<?>) body.get("contents")).hasSize(1);
        String json = MAPPER.writeValueAsString(body);
        assertThat(json).contains("Tìm mũ 3/4 dưới 2 triệu")
                .contains("search_products")
                .doesNotContain("test-key")
                .doesNotContain("TOOL_RESULT")
                .doesNotContain("customerId")
                .doesNotContain("customerEmail")
                .doesNotContain("shippingAddress")
                .doesNotContain("SELECT *");
    }

    @Test
    @DisplayName("system prompt fixes Vietnamese address form and bans warehouse-wide inferences")
    void systemPromptPinsToneAndCatalogueClaimRules() throws Exception {
        Map<String, Object> body = client().buildInitialRequestBody(
                "Tìm mũ bảo hiểm", "vi", new ChatToolRegistry());
        String prompt = MAPPER.writeValueAsString(body.get("systemInstruction"));

        assertThat(prompt)
                .contains("For EVERY Vietnamese answer", "address the customer as")
                .contains("Never open with", "Never use")
                .contains("Product cards are a short page, not a warehouse count")
                .contains("whole-catalogue conclusion");
    }

    @Test
    @DisplayName("unconfigured Bi client never attempts an outbound call")
    void emptyCredentialIsSafe() {
        AiChatClient client = new AiChatClient("  ", "gemini-2.5-flash", 20L);

        assertThat(client.isConfigured()).isFalse();
        assertThat(client.answer(
                "Xin chào", "vi", new ChatToolRegistry(),
                false,
                (call, session) -> { throw new AssertionError("must not execute"); })).isEmpty();
    }
}
