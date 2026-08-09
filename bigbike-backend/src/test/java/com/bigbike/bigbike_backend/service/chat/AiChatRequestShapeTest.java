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
    @DisplayName("Bi disables thinking and caps the customer-visible reply")
    void pinsCostControls() {
        Map<String, Object> config = generation(client().buildRequestBody(
                "Tìm mũ 3/4 dưới 2 triệu.",
                "{\"tool\":\"search_products\",\"results\":[]}",
                "vi"));

        assertThat(config.get("thinkingConfig")).isEqualTo(Map.of("thinkingBudget", 0));
        assertThat(config.get("maxOutputTokens")).isEqualTo(400);
        assertThat(config.get("responseMimeType")).isEqualTo("application/json");
    }

    @Test
    @DisplayName("one request carries only the current question and relevant fixed-tool result")
    void sendsOnlyQuestionAndToolResult() throws Exception {
        Map<String, Object> body = client().buildRequestBody(
                "Tìm mũ 3/4 dưới 2 triệu.",
                "{\"tool\":\"search_products\",\"results\":[{\"name\":\"Mũ A\"}]}",
                "vi");

        assertThat((List<?>) body.get("contents")).hasSize(1);
        String json = MAPPER.writeValueAsString(body);
        assertThat(json).contains("Tìm mũ 3/4 dưới 2 triệu")
                .contains("search_products")
                .contains("Mũ A")
                .doesNotContain("test-key")
                .doesNotContain("customerId")
                .doesNotContain("customerEmail")
                .doesNotContain("shippingAddress")
                .doesNotContain("SELECT *");
    }

    @Test
    @DisplayName("unconfigured Bi client never attempts an outbound call")
    void emptyCredentialIsSafe() {
        AiChatClient client = new AiChatClient("  ", "gemini-2.5-flash", 20L);

        assertThat(client.isConfigured()).isFalse();
        assertThat(client.answer("Xin chào", "{}", "vi")).isEmpty();
    }
}
