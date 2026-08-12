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
                .contains("search_products", "list_categories", "get_product", "get_policy", "get_shop_info", "get_my_orders")
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
    @DisplayName("initial request carries the current question and public category-brand vocabulary only")
    void sendsOnlyCurrentQuestionAndApprovedVocabulary() throws Exception {
        Map<String, Object> body = client().buildInitialRequestBody(
                "Tìm mũ 3/4 dưới 2 triệu.",
                "vi",
                new ChatToolRegistry(),
                new ChatToolService.AssistantCatalogVocabulary(
                        List.of(new ChatToolService.AssistantCategoryVocabulary(
                                "mu-bao-hiem", "Mũ bảo hiểm", "Helmets")),
                        List.of(new ChatToolService.AssistantBrandVocabulary("agv", "AGV"))),
                List.of("mu-bao-hiem-fullface-retro-ilm-z503"));

        assertThat((List<?>) body.get("contents")).hasSize(1);
        String json = MAPPER.writeValueAsString(body);
        assertThat(json).contains("Tìm mũ 3/4 dưới 2 triệu")
                .contains("search_products")
                .contains("PUBLIC_CATALOG_VOCABULARY", "mu-bao-hiem", "Mũ bảo hiểm", "AGV")
                .contains("RECENT_VERIFIED_PRODUCTS", "mu-bao-hiem-fullface-retro-ilm-z503")
                .doesNotContain("test-key")
                .doesNotContain("TOOL_RESULT")
                .doesNotContain("customerId")
                .doesNotContain("customerEmail")
                .doesNotContain("shippingAddress")
                .doesNotContain("ILM Z503")
                .doesNotContain("retailPrice")
                .doesNotContain("salePrice")
                .doesNotContain("stockState")
                .doesNotContain("SELECT *");
    }

    @Test
    @DisplayName("system prompt bans wrong Vietnamese address and distinguishes cards from catalogue totals")
    void systemPromptPinsToneAndCatalogueClaimRules() throws Exception {
        Map<String, Object> body = client().buildInitialRequestBody(
                "Tìm mũ bảo hiểm", "vi", new ChatToolRegistry());
        String prompt = MAPPER.writeValueAsString(body.get("systemInstruction"));

        assertThat(prompt)
                .contains("do not add either merely to satisfy a keyword rule", "Never call the", "customer")
                .contains("PUBLIC_CATALOG_VOCABULARY", "interpret customer shorthand")
                .contains("RECENT_VERIFIED_PRODUCTS", "server-verified public slugs")
                .contains("Product cards are a short page, not a warehouse count")
                .contains("displayedCardCount", "whole-catalogue", "conclusion");
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
