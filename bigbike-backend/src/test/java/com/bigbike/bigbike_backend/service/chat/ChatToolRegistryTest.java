package com.bigbike.bigbike_backend.service.chat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;

class ChatToolRegistryTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final Set<String> GEMINI_SCHEMA_FIELDS = Set.of(
            "type", "format", "title", "description", "nullable", "enum",
            "maxItems", "minItems", "properties", "required", "minProperties",
            "maxProperties", "minLength", "maxLength", "pattern", "example",
            "anyOf", "propertyOrdering", "default", "items", "minimum", "maximum");
    private final ChatToolRegistry registry = new ChatToolRegistry();

    @Test
    void declarationsExposeOnlyTheSevenReadOnlyTools() {
        List<Map<String, Object>> declarations = registry.functionDeclarations();

        assertThat(declarations).extracting(value -> value.get("name"))
                .containsExactly(
                        "search_products", "list_categories", "get_product", "get_policy",
                        "get_shop_info", "get_my_orders", "search_articles")
                .doesNotContain("capture_lead");
        assertThat(MAPPER.valueToTree(declarations).toString())
                .doesNotContain("additionalProperties")
                .doesNotContain("customerId", "email", "phone", "sql", "table", "column");
    }

    @Test
    void declarationsUseOnlyTheGenerateContentParametersSchemaSubset() {
        List<Map<String, Object>> declarations = registry.functionDeclarations();

        for (Map<String, Object> declaration : declarations) {
            if (ChatToolRegistry.GET_SHOP_INFO.equals(declaration.get("name"))
                    || ChatToolRegistry.LIST_CATEGORIES.equals(declaration.get("name"))) {
                assertThat(declaration).containsOnlyKeys("name", "description");
            } else {
                assertThat(declaration).containsOnlyKeys("name", "description", "parameters");
            }
            Object parameters = declaration.get("parameters");
            if (parameters != null) assertSchemaFields(MAPPER.valueToTree(parameters));
        }

        Map<String, Object> shopInfo = declarations.stream()
                .filter(declaration -> ChatToolRegistry.GET_SHOP_INFO.equals(declaration.get("name")))
                .findFirst()
                .orElseThrow();
        assertThat(shopInfo).doesNotContainKey("parameters");
        Map<String, Object> categories = declarations.stream()
                .filter(declaration -> ChatToolRegistry.LIST_CATEGORIES.equals(declaration.get("name")))
                .findFirst()
                .orElseThrow();
        assertThat(categories).doesNotContainKey("parameters");
    }

    @Test
    void validProductSearchUsesOnlyAllowlistedTypedArguments() {
        ChatToolRegistry.ValidatedCall call = registry.validate(
                ChatToolRegistry.SEARCH_PRODUCTS,
                json(Map.of(
                        "query", "mũ tanami",
                        "brand", "caberg",
                        "minPrice", 5_000_000,
                        "maxPrice", 15_000_000,
                        "sort", "price:asc",
                        "lang", "vi")));

        assertThat(call.arguments()).containsOnlyKeys(
                "query", "brand", "minPrice", "maxPrice", "sort", "lang");
        assertThat(call.arguments().get("minPrice")).isEqualTo(5_000_000L);
    }

    @Test
    void catalogFiltersAreAllowlistedButConversationContextStaysBackendOnly() {
        ChatToolRegistry.ValidatedCall call = registry.validate(
                ChatToolRegistry.SEARCH_PRODUCTS,
                json(Map.of(
                        "category", "mu-bao-hiem",
                        "brand", "ls2",
                        "minPrice", 3_000_000,
                        "lang", "vi")));

        assertThat(call.arguments()).containsExactlyInAnyOrderEntriesOf(Map.of(
                "category", "mu-bao-hiem",
                "brand", "ls2",
                "minPrice", 3_000_000L,
                "lang", "vi"));
        assertRejected(ChatToolRegistry.SEARCH_PRODUCTS,
                Map.of("query", "mũ", "context", "mũ ở lượt trước", "lang", "vi"));
        assertRejected(ChatToolRegistry.SEARCH_PRODUCTS,
                Map.of("query", "mũ", "history", "nội dung chat cũ", "lang", "vi"));
        assertRejected(ChatToolRegistry.SEARCH_PRODUCTS,
                Map.of("query", "mũ", "productSlugs", List.of("mu-truoc"), "lang", "vi"));
    }

    @Test
    void listCategoriesHasNoArgumentsAndRejectsDynamicQuerying() {
        assertThat(registry.validate(ChatToolRegistry.LIST_CATEGORIES, json(Map.of())).arguments()).isEmpty();
        assertRejected(ChatToolRegistry.LIST_CATEGORIES, Map.of("lang", "vi"));
        assertRejected(ChatToolRegistry.LIST_CATEGORIES, Map.of("query", "SELECT * FROM products"));
    }

    @Test
    void rejectsIdentitySqlUnknownFieldsAndMalformedShapes() {
        assertRejected(ChatToolRegistry.GET_MY_ORDERS,
                Map.of("scope", "latest", "customerId", "b50d48b0"));
        assertRejected(ChatToolRegistry.GET_MY_ORDERS,
                Map.of("scope", "recent", "email", "customer@example.com"));
        assertRejected(ChatToolRegistry.SEARCH_PRODUCTS,
                Map.of("query", "SELECT * FROM products", "lang", "vi"));
        assertRejected(ChatToolRegistry.SEARCH_PRODUCTS,
                Map.of("query", "mũ", "table", "products", "lang", "vi"));
        assertRejected(ChatToolRegistry.SEARCH_PRODUCTS,
                Map.of("query", List.of("mũ"), "lang", "vi"));
        assertRejected(ChatToolRegistry.SEARCH_PRODUCTS,
                Map.of("sort", "createdAt:desc", "lang", "vi"));
        assertRejected("capture_lead", Map.of());
        assertRejected("read_any_table", Map.of());
    }

    @Test
    void rejectsInvalidEnumsPriceRangesAndUnexpectedArguments() {
        assertRejected(ChatToolRegistry.GET_POLICY, Map.of("topic", "site_setting_key"));
        assertRejected(ChatToolRegistry.GET_SHOP_INFO, Map.of("key", "hotline"));
        assertRejected(ChatToolRegistry.GET_MY_ORDERS, Map.of("scope", "all"));
        assertRejected(ChatToolRegistry.GET_PRODUCT,
                Map.of("slug", "../../admin/products"));
        assertRejected(ChatToolRegistry.SEARCH_PRODUCTS,
                Map.of("query", "mũ", "minPrice", 10, "maxPrice", 5, "lang", "vi"));
        assertRejected(ChatToolRegistry.SEARCH_PRODUCTS,
                Map.of("query", "mũ", "minPrice", -1, "lang", "vi"));
    }

    private void assertRejected(String name, Map<String, ?> arguments) {
        assertThatThrownBy(() -> registry.validate(name, json(arguments)))
                .isInstanceOf(ChatToolRegistry.ToolValidationException.class);
    }

    private static JsonNode json(Map<String, ?> value) {
        return MAPPER.valueToTree(value);
    }

    private static void assertSchemaFields(JsonNode schema) {
        var fields = schema.fieldNames();
        while (fields.hasNext()) {
            String field = fields.next();
            assertThat(GEMINI_SCHEMA_FIELDS).contains(field);
            JsonNode value = schema.get(field);
            if ("properties".equals(field)) {
                value.fields().forEachRemaining(entry -> assertSchemaFields(entry.getValue()));
            } else if ("items".equals(field) && value.isObject()) {
                assertSchemaFields(value);
            } else if ("anyOf".equals(field) && value.isArray()) {
                value.forEach(ChatToolRegistryTest::assertSchemaFields);
            }
        }
    }
}
