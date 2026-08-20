package com.bigbike.bigbike_backend.service.chat;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

/**
 * The complete function allowlist exposed to Gemini. Provider-side schemas improve tool
 * selection, but every call is validated again here before any service or repository runs.
 */
@Component
public class ChatToolRegistry {

    public static final String SEARCH_PRODUCTS = "search_products";
    public static final String LIST_CATEGORIES = "list_categories";
    public static final String GET_PRODUCT = "get_product";
    public static final String GET_POLICY = "get_policy";
    public static final String GET_SHOP_INFO = "get_shop_info";
    public static final String GET_MY_ORDERS = "get_my_orders";
    public static final String SEARCH_ARTICLES = "search_articles";

    private static final List<String> TOOL_ORDER = List.of(
            SEARCH_PRODUCTS, LIST_CATEGORIES, GET_PRODUCT, GET_POLICY, GET_SHOP_INFO,
            GET_MY_ORDERS, SEARCH_ARTICLES);
    private static final Set<String> SEARCH_FIELDS = Set.of(
            "query", "category", "brand", "color", "size",
            "minPrice", "maxPrice", "sort", "lang");
    private static final Set<String> SEARCH_TEXT_FIELDS = Set.of(
            "query", "category", "brand", "color", "size");
    private static final Set<String> SORT_VALUES = Set.of(
            "price:asc", "price:desc", "createdAt:desc");
    private static final Set<String> LANG_VALUES = Set.of("vi", "en");
    private static final Set<String> POLICY_TOPICS = Set.of(
            "warranty", "return_exchange", "payment", "shipping", "size", "privacy");
    private static final Set<String> ORDER_SCOPES = Set.of("latest", "recent");
    private static final Pattern SLUG = Pattern.compile("^[a-z0-9]+(?:-[a-z0-9]+)*$");
    private static final Pattern SQL_SHAPE = Pattern.compile(
            "(?is)(;|--|/\\*|\\*/|\\bselect\\s+.+?\\s+from\\b|"
                    + "\\binsert\\s+into\\b|\\bupdate\\s+\\S+\\s+set\\b|"
                    + "\\bdelete\\s+from\\b|\\bdrop\\s+(?:table|database)\\b|"
                    + "\\balter\\s+table\\b|\\bunion\\s+select\\b)");

    public List<Map<String, Object>> functionDeclarations() {
        return functionDeclarations(new LinkedHashSet<>(TOOL_ORDER));
    }

    public List<Map<String, Object>> functionDeclarations(Set<String> allowedNames) {
        List<Map<String, Object>> declarations = new ArrayList<>();
        for (String name : TOOL_ORDER) {
            if (allowedNames.contains(name)) declarations.add(declaration(name));
        }
        return List.copyOf(declarations);
    }

    public ValidatedCall validate(String name, JsonNode arguments) {
        if (name == null || !TOOL_ORDER.contains(name)) {
            throw new ToolValidationException("Unknown tool");
        }
        if (arguments == null || !arguments.isObject()) {
            throw new ToolValidationException("Arguments must be an object");
        }
        return switch (name) {
            case SEARCH_PRODUCTS -> validateSearch(arguments);
            case LIST_CATEGORIES -> validateNoArguments(name, arguments);
            case GET_PRODUCT -> validateGetProduct(arguments);
            case GET_POLICY -> validateEnumCall(name, arguments, "topic", POLICY_TOPICS);
            case GET_SHOP_INFO -> validateNoArguments(name, arguments);
            case GET_MY_ORDERS -> validateEnumCall(name, arguments, "scope", ORDER_SCOPES);
            case SEARCH_ARTICLES -> validateArticleSearch(arguments);
            default -> throw new ToolValidationException("Unknown tool");
        };
    }

    private static ValidatedCall validateSearch(JsonNode arguments) {
        rejectUnknown(arguments, SEARCH_FIELDS);
        Map<String, Object> values = new LinkedHashMap<>();
        for (String field : SEARCH_TEXT_FIELDS) {
            if (arguments.has(field)) {
                int limit = "query".equals(field) ? 200 : 100;
                values.put(field, requiredText(arguments, field, limit));
            }
        }
        Long minPrice = optionalNonNegativeLong(arguments, "minPrice");
        Long maxPrice = optionalNonNegativeLong(arguments, "maxPrice");
        if (minPrice != null) values.put("minPrice", minPrice);
        if (maxPrice != null) values.put("maxPrice", maxPrice);
        if (minPrice != null && maxPrice != null && minPrice > maxPrice) {
            throw new ToolValidationException("Invalid price range");
        }
        if (arguments.has("sort")) {
            String sort = requiredText(arguments, "sort", 32);
            if (!SORT_VALUES.contains(sort)) throw new ToolValidationException("Invalid sort");
            values.put("sort", sort);
        }
        String lang = requiredText(arguments, "lang", 2);
        if (!LANG_VALUES.contains(lang)) throw new ToolValidationException("Invalid language");
        values.put("lang", lang);

        boolean hasFilter = SEARCH_TEXT_FIELDS.stream().anyMatch(values::containsKey)
                || minPrice != null || maxPrice != null;
        if (!hasFilter) throw new ToolValidationException("Unbounded product search");
        return new ValidatedCall(SEARCH_PRODUCTS, Map.copyOf(values));
    }

    private static ValidatedCall validateGetProduct(JsonNode arguments) {
        rejectUnknown(arguments, Set.of("slug"));
        String slug = requiredText(arguments, "slug", 255);
        if (!SLUG.matcher(slug).matches()) throw new ToolValidationException("Invalid slug");
        return new ValidatedCall(GET_PRODUCT, Map.of("slug", slug));
    }

    private static ValidatedCall validateArticleSearch(JsonNode arguments) {
        rejectUnknown(arguments, Set.of("query", "lang"));
        String query = requiredText(arguments, "query", 200);
        String lang = requiredText(arguments, "lang", 2);
        if (!LANG_VALUES.contains(lang)) throw new ToolValidationException("Invalid language");
        return new ValidatedCall(SEARCH_ARTICLES, Map.of("query", query, "lang", lang));
    }

    private static ValidatedCall validateNoArguments(String name, JsonNode arguments) {
        rejectUnknown(arguments, Set.of());
        return new ValidatedCall(name, Map.of());
    }

    private static ValidatedCall validateEnumCall(
            String name, JsonNode arguments, String field, Set<String> allowed) {
        rejectUnknown(arguments, Set.of(field));
        String value = requiredText(arguments, field, 32);
        if (!allowed.contains(value)) throw new ToolValidationException("Invalid enum value");
        return new ValidatedCall(name, Map.of(field, value));
    }

    private static void rejectUnknown(JsonNode arguments, Set<String> allowed) {
        arguments.fieldNames().forEachRemaining(field -> {
            if (!allowed.contains(field)) throw new ToolValidationException("Unknown argument");
        });
    }

    private static String requiredText(JsonNode arguments, String field, int maxLength) {
        JsonNode value = arguments.get(field);
        if (value == null || !value.isTextual()) throw new ToolValidationException("Invalid text argument");
        String text = value.textValue().trim();
        if (text.isEmpty() || text.length() > maxLength || SQL_SHAPE.matcher(text).find()) {
            throw new ToolValidationException("Unsafe text argument");
        }
        return text;
    }

    private static Long optionalNonNegativeLong(JsonNode arguments, String field) {
        JsonNode value = arguments.get(field);
        if (value == null) return null;
        if (!value.isIntegralNumber() || !value.canConvertToLong()) {
            throw new ToolValidationException("Invalid numeric argument");
        }
        long number = value.longValue();
        if (number < 0) throw new ToolValidationException("Invalid numeric argument");
        return number;
    }

    private static Map<String, Object> declaration(String name) {
        return switch (name) {
            case SEARCH_PRODUCTS -> function(name,
                    "Find products currently sold by BigBike for name, model, category, brand, option or price discovery. Use the supplied public catalog vocabulary to interpret shorthand and natural wording into a canonical category, brand or generic product-type query. Never invent a product name, model/code or slug, and never invent or expand price, colour or size. The backend verifies every filter and enforces publication, availability, effective price and result limits. It may return exact current-scope totals only for a verified non-model search; never infer a count when that evidence is absent.",
                    objectSchema(searchProperties(), List.of("lang")));
            case LIST_CATEGORIES -> function(name,
                    "List public BigBike product categories and the verified number of currently sellable products in each category. This tool has no arguments and never returns individual products, prices or detailed stock.",
                    null);
            case GET_PRODUCT -> function(name,
                    "Read public details for one exact product slug returned by search_products in this turn, or supplied exactly by the customer.",
                    objectSchema(Map.of("slug", stringSchema(255, null)), List.of("slug")));
            case GET_POLICY -> function(name,
                    "Read one published BigBike policy topic.",
                    objectSchema(Map.of("topic", stringSchema(null, POLICY_TOPICS)), List.of("topic")));
            case GET_SHOP_INFO -> function(name,
                    "Read BigBike hotline, Zalo, Messenger, address and opening hours.",
                    null);
            case GET_MY_ORDERS -> function(name,
                    "Read minimal order summaries for the currently signed-in customer. Never ask for identity arguments.",
                    objectSchema(Map.of("scope", stringSchema(null, ORDER_SCOPES)), List.of("scope")));
            case SEARCH_ARTICLES -> function(name,
                    "Search up to three published BigBike articles for general product-use knowledge. Article results never provide live price, promotion, stock, variants, contact details, delivery promises or store policy, and never include a URL. Use only when general article knowledge is relevant.",
                    objectSchema(Map.of(
                            "query", stringSchema(200, null),
                            "lang", stringSchema(null, LANG_VALUES)), List.of("query", "lang")));
            default -> throw new IllegalArgumentException("Unknown declaration");
        };
    }

    private static Map<String, Object> searchProperties() {
        Map<String, Object> properties = new LinkedHashMap<>();
        properties.put("query", stringSchema(200, null));
        properties.put("category", stringSchema(100, null));
        properties.put("brand", stringSchema(100, null));
        properties.put("color", stringSchema(100, null));
        properties.put("size", stringSchema(100, null));
        properties.put("minPrice", Map.of("type", "integer", "minimum", 0));
        properties.put("maxPrice", Map.of("type", "integer", "minimum", 0));
        properties.put("sort", stringSchema(null, SORT_VALUES));
        properties.put("lang", stringSchema(null, LANG_VALUES));
        return properties;
    }

    private static Map<String, Object> function(
            String name, String description, Map<String, Object> parameters) {
        Map<String, Object> function = new LinkedHashMap<>();
        function.put("name", name);
        function.put("description", description);
        if (parameters != null) function.put("parameters", parameters);
        return Map.copyOf(function);
    }

    private static Map<String, Object> objectSchema(
            Map<String, Object> properties, List<String> required) {
        Map<String, Object> schema = new LinkedHashMap<>();
        schema.put("type", "object");
        schema.put("properties", properties);
        if (!required.isEmpty()) schema.put("required", required);
        return schema;
    }

    private static Map<String, Object> stringSchema(Integer maxLength, Set<String> values) {
        Map<String, Object> schema = new LinkedHashMap<>();
        schema.put("type", "string");
        if (maxLength != null) schema.put("maxLength", maxLength);
        if (values != null) schema.put("enum", List.copyOf(values));
        return schema;
    }

    public record ValidatedCall(String name, Map<String, Object> arguments) {}

    public static final class ToolValidationException extends RuntimeException {
        public ToolValidationException(String message) {
            super(message);
        }
    }
}
