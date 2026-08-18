package com.bigbike.bigbike_backend.service.chat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.api.chat.dto.ChatContactResponse;
import com.bigbike.bigbike_backend.domain.catalog.Brand;
import com.bigbike.bigbike_backend.domain.catalog.Category;
import com.bigbike.bigbike_backend.domain.catalog.HomepageBlock;
import com.bigbike.bigbike_backend.domain.catalog.Product;
import com.bigbike.bigbike_backend.domain.catalog.ProductHighlights;
import com.bigbike.bigbike_backend.domain.catalog.ProductPrice;
import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.service.catalog.CatalogReadService;
import com.bigbike.bigbike_backend.service.common.PageResult;
import com.bigbike.bigbike_backend.service.order.OrderReadService;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** Regression coverage for CHAT_RULE_017's AI-interpretation branch. */
class ChatSearchInterpretationTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final ChatAssistantSettings.Snapshot NEW_SETTINGS = new ChatAssistantSettings.Snapshot(
            true,
            60,
            true,
            "Xin chào",
            List.of("A", "B", "C"),
            new ChatContactResponse("0900", "", "", "", ""),
            "", "", "");
    private static final ChatAssistantSettings.Snapshot LEGACY_SETTINGS = new ChatAssistantSettings.Snapshot(
            true,
            60,
            false,
            "Xin chào",
            List.of("A", "B", "C"),
            new ChatContactResponse("0900", "", "", "", ""),
            "", "", "");

    @Test
    void shorthandNaturalWordingAndPriceFormsReachTheInterpretedPublicCategory() {
        List<SearchCase> cases = List.of(
                new SearchCase("mbh", "Mũ bảo hiểm", "mũ bảo hiểm", "mu-bao-hiem", null),
                new SearchCase("nón", "Mũ bảo hiểm", "mũ bảo hiểm", "mu-bao-hiem", null),
                new SearchCase("mũ ff", "Mũ bảo hiểm fullface", "fullface", "mu-bao-hiem-fullface", null),
                new SearchCase("tn", "Tai nghe bluetooth mũ bảo hiểm", "tai nghe", "tai-nghe-bluetooth-mu-bao-hiem", null),
                new SearchCase("mbh 2 củ", "Mũ bảo hiểm", "mũ bảo hiểm", "mu-bao-hiem", 1_400_000L),
                new SearchCase("mbh 1tr5", "Mũ bảo hiểm", "mũ bảo hiểm", "mu-bao-hiem", 1_050_000L),
                new SearchCase("còn tai nghe thì sao", "Tai nghe bluetooth mũ bảo hiểm", "tai nghe", "tai-nghe-bluetooth-mu-bao-hiem", null),
                new SearchCase("Chuyển sang tìm tai nghe", "Tai nghe bluetooth mũ bảo hiểm", "tai nghe", "tai-nghe-bluetooth-mu-bao-hiem", null));

        for (SearchCase searchCase : cases) {
            CatalogReadService catalog = catalogWithPublicVocabulary();
            Product expected = product("safe-" + searchCase.expectedCategory(), "Sản phẩm an toàn",
                    BigDecimal.valueOf(1_500_000));
        when(catalog.listProducts(anyInt(), anyInt(), any(), any(), any(), any(), any(), anyList(),
                    any(), any(), any(), any()))
                    .thenReturn(new PageResult<>(List.of(expected), 1, 10, 1, 1));
            ChatToolService tools = new ChatToolService(catalog, mock(OrderReadService.class));
            Map<String, Object> arguments = new java.util.LinkedHashMap<>();
            arguments.put("category", searchCase.modelCategory());
            arguments.put("query", searchCase.modelQuery());
            arguments.put("lang", "vi");

            ChatToolService.ToolExecution result = tools.execute(
                    new ChatToolRegistry().validate(
                            ChatToolRegistry.SEARCH_PRODUCTS, MAPPER.valueToTree(arguments)),
                    new ChatToolService.ToolContext(
                            searchCase.question(), "vi", null, NEW_SETTINGS),
                    new ChatToolService.ToolSession());

            assertThat(result.products()).as(searchCase.question())
                    .extracting(card -> card.slug()).containsExactly(expected.slug());
            assertThat(result.responseJson()).as(searchCase.question())
                    .contains("\"category\":\"" + searchCase.expectedCategory() + "\"");
            if (searchCase.expectedMinPrice() != null) {
                assertThat(result.responseJson()).as(searchCase.question())
                        .contains("\"requestedMinPrice\":" + searchCase.expectedMinPrice());
            }
            verify(catalog, atLeastOnce()).listProducts(anyInt(), anyInt(), any(), any(), any(), any(), any(), any(),
                    any(), any(), any(), any());
        }
    }

    @Test
    void shortFollowUpUsesThePreviouslyAcceptedSemanticScope() {
        CatalogReadService catalog = catalogWithPublicVocabulary();
        Product headset = product("headset-safe", "Tai nghe an toàn", BigDecimal.valueOf(1_500_000));
        when(catalog.listProducts(anyInt(), anyInt(), any(), any(), any(), any(), any(), anyList(),
                any(), any(), any(), any()))
                .thenReturn(new PageResult<>(List.of(headset), 1, 10, 1, 1));
        ChatToolService tools = new ChatToolService(catalog, mock(OrderReadService.class));
        ChatToolService.ConversationContext previous = new ChatToolService.ConversationContext(
                "tai-nghe-bluetooth-mu-bao-hiem", null, null, null, List.of("headset-safe"), false);

        ChatToolService.ToolExecution result = tools.execute(
                new ChatToolRegistry().validate(ChatToolRegistry.SEARCH_PRODUCTS,
                        MAPPER.valueToTree(Map.of("query", "tai nghe", "lang", "vi"))),
                new ChatToolService.ToolContext("cái nào rẻ hơn", "vi", null, NEW_SETTINGS, previous),
                new ChatToolService.ToolSession());

        assertThat(result.products()).extracting(card -> card.slug()).containsExactly("headset-safe");
        assertThat(result.searchScope()).isNotNull();
        assertThat(result.searchScope().category()).isEqualTo("tai-nghe-bluetooth-mu-bao-hiem");
    }

    @Test
    void modelVerifiedCategorySwitchDoesNotRetainOldFilters() {
        CatalogReadService catalog = catalogWithPublicVocabulary();
        Product headset = product("headset-safe", "Tai nghe an toàn", BigDecimal.valueOf(3_500_000));
        when(catalog.listProducts(anyInt(), anyInt(), any(), any(), any(), any(), any(), anyList(),
                any(), any(), any(), any()))
                .thenReturn(new PageResult<>(List.of(headset), 1, 10, 1, 1));
        ChatToolService tools = new ChatToolService(catalog, mock(OrderReadService.class));
        ChatToolService.ConversationContext previous = new ChatToolService.ConversationContext(
                "mu-bao-hiem", "ilm", 4_000_000L, 5_000_000L,
                List.of("mu-bao-hiem-fullface-retro-ilm-z503"), false);

        ChatToolService.ToolExecution result = tools.execute(
                new ChatToolRegistry().validate(ChatToolRegistry.SEARCH_PRODUCTS,
                        MAPPER.valueToTree(Map.of(
                                // RECENT_TURNS lets the model identify the switch; the backend accepts
                                // only the exact canonical value from current public metadata.
                                "category", "Tai nghe bluetooth mũ bảo hiểm",
                                "query", "tai nghe",
                                "lang", "vi"))),
                new ChatToolService.ToolContext(
                        "còn tai nghe thì sao", "vi", null, NEW_SETTINGS, previous),
                new ChatToolService.ToolSession());

        assertThat(result.products()).extracting(card -> card.slug()).containsExactly("headset-safe");
        assertThat(result.responseJson())
                .contains("\"category\":\"tai-nghe-bluetooth-mu-bao-hiem\"", "\"brand\":\"\"")
                .contains("\"min_price\":\"\"", "\"max_price\":\"\"")
                .doesNotContain("4000000", "5000000", "\"brand\":\"ilm\"");
        verify(catalog, atLeastOnce()).listProducts(anyInt(), anyInt(), any(),
                org.mockito.ArgumentMatchers.eq("tai-nghe-bluetooth-mu-bao-hiem"),
                org.mockito.ArgumentMatchers.isNull(), any(), any(), any(),
                org.mockito.ArgumentMatchers.isNull(), org.mockito.ArgumentMatchers.isNull(), any(), any());
    }

    @Test
    void modelPriceWithoutCustomerPriceIsDroppedButSearchContinues() {
        CatalogReadService catalog = catalogWithPublicVocabulary();
        Product helmet = product("helmet-safe", "Mũ bảo hiểm an toàn", BigDecimal.valueOf(1_500_000));
        when(catalog.listProducts(anyInt(), anyInt(), any(), any(), any(), any(), any(), anyList(),
                any(), any(), any(), any()))
                .thenReturn(new PageResult<>(List.of(helmet), 1, 10, 1, 1));
        ChatToolService tools = new ChatToolService(catalog, mock(OrderReadService.class));

        ChatToolService.ToolExecution result = tools.execute(
                new ChatToolRegistry().validate(ChatToolRegistry.SEARCH_PRODUCTS,
                        MAPPER.valueToTree(Map.of(
                                "category", "Mũ bảo hiểm",
                                "query", "mũ bảo hiểm",
                                "minPrice", 100L,
                                "maxPrice", 200L,
                                "lang", "vi"))),
                new ChatToolService.ToolContext("mbh", "vi", null, NEW_SETTINGS),
                new ChatToolService.ToolSession());

        assertThat(result.products()).extracting(card -> card.slug()).containsExactly("helmet-safe");
        assertThat(result.responseJson()).contains("\"min_price\":\"\"", "\"max_price\":\"\"");
    }

    @Test
    void modelPriceConflictWithAnInheritedCustomerRangeIsDroppedButTheSafeRangeRemains() {
        CatalogReadService catalog = catalogWithPublicVocabulary();
        Product helmet = product("helmet-safe", "Mũ bảo hiểm an toàn", BigDecimal.valueOf(1_500_000));
        when(catalog.listProducts(anyInt(), anyInt(), any(), any(), any(), any(), any(), anyList(),
                any(), any(), any(), any()))
                .thenReturn(new PageResult<>(List.of(helmet), 1, 10, 1, 1));
        ChatToolService tools = new ChatToolService(catalog, mock(OrderReadService.class));
        ChatToolService.ConversationContext previous = new ChatToolService.ConversationContext(
                "mu-bao-hiem", null, 1_000_000L, 2_000_000L, List.of("helmet-safe"), false);

        ChatToolService.ToolExecution result = tools.execute(
                new ChatToolRegistry().validate(ChatToolRegistry.SEARCH_PRODUCTS,
                        MAPPER.valueToTree(Map.of(
                                "query", "mũ bảo hiểm",
                                "minPrice", 100L,
                                "maxPrice", 200L,
                                "lang", "vi"))),
                new ChatToolService.ToolContext("cái nào rẻ hơn", "vi", null, NEW_SETTINGS, previous),
                new ChatToolService.ToolSession());

        assertThat(result.products()).extracting(card -> card.slug()).containsExactly("helmet-safe");
        assertThat(result.responseJson())
                .contains("\"requestedMinPrice\":1000000", "\"requestedMaxPrice\":2000000")
                .doesNotContain("\"requestedMinPrice\":100,", "\"requestedMaxPrice\":200,");
    }

    @Test
    void nonexistentCategoryIsDroppedInsteadOfFailingTheWholeTurn() {
        CatalogReadService catalog = catalogWithPublicVocabulary();
        Product helmet = product("helmet-safe", "Mũ bảo hiểm an toàn", BigDecimal.valueOf(1_500_000));
        when(catalog.listProducts(anyInt(), anyInt(), any(), any(), any(), any(), any(), anyList(),
                any(), any(), any(), any()))
                .thenReturn(new PageResult<>(List.of(helmet), 1, 10, 1, 1));
        ChatToolService tools = new ChatToolService(catalog, mock(OrderReadService.class));

        ChatToolService.ToolExecution result = tools.execute(
                new ChatToolRegistry().validate(ChatToolRegistry.SEARCH_PRODUCTS,
                        MAPPER.valueToTree(Map.of(
                                "category", "Nhóm không tồn tại",
                                "query", "mũ bảo hiểm",
                                "lang", "vi"))),
                new ChatToolService.ToolContext("mbh", "vi", null, NEW_SETTINGS),
                new ChatToolService.ToolSession());

        assertThat(result.products()).extracting(card -> card.slug()).containsExactly("helmet-safe");
        assertThat(result.responseJson()).contains("\"category\":\"\"");
    }

    @Test
    void inventedProductModelCannotCreateAnInventedCard() {
        CatalogReadService catalog = catalogWithPublicVocabulary();
        Product helmet = product("helmet-safe", "Mũ bảo hiểm an toàn", BigDecimal.valueOf(1_500_000));
        when(catalog.listProducts(anyInt(), anyInt(), any(), any(), any(), any(), any(), anyList(),
                any(), any(), any(), any()))
                .thenReturn(new PageResult<>(List.of(helmet), 1, 10, 1, 1));
        ChatToolService tools = new ChatToolService(catalog, mock(OrderReadService.class));

        ChatToolService.ToolExecution result = tools.execute(
                new ChatToolRegistry().validate(ChatToolRegistry.SEARCH_PRODUCTS,
                        MAPPER.valueToTree(Map.of(
                                "category", "Mũ bảo hiểm",
                                "query", "Imaginary ZX-999",
                                "lang", "vi"))),
                new ChatToolService.ToolContext("tìm mũ bảo hiểm", "vi", null, NEW_SETTINGS),
                new ChatToolService.ToolSession());

        assertThat(result.products()).extracting(card -> card.name())
                .containsExactly("Mũ bảo hiểm an toàn")
                .doesNotContain("Imaginary ZX-999");
        assertThat(result.responseJson()).doesNotContain("Imaginary", "ZX-999");
    }

    @Test
    void priceRangeMissCarriesTheMandatoryDisclosureForTheResponseGuard() {
        CatalogReadService catalog = catalogWithPublicVocabulary();
        Product outsideRange = product("helmet-319", "Mũ bảo hiểm ngoài tầm", BigDecimal.valueOf(3_190_000));
        when(catalog.listProducts(anyInt(), anyInt(), any(), any(), any(), any(), any(), anyList(),
                any(), any(), any(), any()))
                .thenReturn(new PageResult<>(List.of(outsideRange), 1, 10, 1, 1));
        ChatToolService tools = new ChatToolService(catalog, mock(OrderReadService.class));

        ChatToolService.ToolExecution result = tools.execute(
                new ChatToolRegistry().validate(ChatToolRegistry.SEARCH_PRODUCTS,
                        MAPPER.valueToTree(Map.of(
                                "category", "Mũ bảo hiểm",
                                "query", "mũ bảo hiểm",
                                "lang", "vi"))),
                new ChatToolService.ToolContext(
                        "mbh tầm 1 đến 2 triệu", "vi", null, NEW_SETTINGS),
                new ChatToolService.ToolSession());

        assertThat(result.products()).extracting(card -> card.slug()).containsExactly("helmet-319");
        assertThat(result.requiredDisclosures())
                .contains(ChatToolService.RequiredDisclosure.PRICE_RANGE_MISS);
        assertThat(new ChatResponseGuard().checkModel(
                "Dạ, em đã tìm được sản phẩm để anh/chị xem thêm. Anh/chị có thể mở thẻ sản phẩm bên dưới.",
                result.products(),
                "vi",
                List.of(),
                result.requiredDisclosures())).isEmpty();
    }

    @Test
    void exactModelRequestsRemainUsableForLs2AndAgv() {
        for (SearchCase searchCase : List.of(
                new SearchCase("LS2 OF616 Airflow II", null, "LS2 OF616 Airflow II", null, null),
                new SearchCase("mũ AGV K3", "Mũ bảo hiểm", "AGV K3", "mu-bao-hiem", null))) {
            CatalogReadService catalog = catalogWithPublicVocabulary();
            Product exact = product("exact-" + searchCase.question().replaceAll("[^a-zA-Z0-9]", ""),
                    searchCase.question(), BigDecimal.valueOf(1_500_000));
            when(catalog.searchProductsForAssistant(any(), any(), any(), any(), any(), any(), anyInt(), any()))
                    .thenReturn(List.of(exact));
            ChatToolService tools = new ChatToolService(catalog, mock(OrderReadService.class));
            Map<String, Object> args = new java.util.LinkedHashMap<>();
            args.put("query", searchCase.modelQuery());
            if ("mũ AGV K3".equals(searchCase.question())) {
                args.put("category", "Mũ bảo hiểm");
                args.put("brand", "AGV");
            } else {
                args.put("brand", "LS2");
            }
            args.put("lang", "vi");

            ChatToolService.ToolExecution result = tools.execute(
                    new ChatToolRegistry().validate(ChatToolRegistry.SEARCH_PRODUCTS, MAPPER.valueToTree(args)),
                    new ChatToolService.ToolContext(searchCase.question(), "vi", null, NEW_SETTINGS),
                    new ChatToolService.ToolSession());

            assertThat(result.products()).as(searchCase.question())
                    .extracting(card -> card.slug()).containsExactly(exact.slug());
        }
    }

    @Test
    void legacySwitchKeepsThePreviousWholeTurnRejection() {
        CatalogReadService catalog = catalogWithPublicVocabulary();
        ChatToolService tools = new ChatToolService(catalog, mock(OrderReadService.class));

        assertThatThrownBy(() -> tools.execute(
                new ChatToolRegistry().validate(ChatToolRegistry.SEARCH_PRODUCTS,
                        MAPPER.valueToTree(Map.of(
                                "category", "Tai nghe bluetooth mũ bảo hiểm",
                                "lang", "vi"))),
                new ChatToolService.ToolContext("mbh", "vi", null, LEGACY_SETTINGS),
                new ChatToolService.ToolSession()))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void sqlShapedModelArgumentsRemainRejectedBeforeTheCatalogIsRead() {
        ChatToolRegistry registry = new ChatToolRegistry();
        assertThatThrownBy(() -> registry.validate(ChatToolRegistry.SEARCH_PRODUCTS,
                MAPPER.valueToTree(Map.of("query", "SELECT * FROM products", "lang", "vi"))))
                .isInstanceOf(ChatToolRegistry.ToolValidationException.class);
    }

    @Test
    void listCategoriesReturnsOnlyPublicNamesAndVerifiedSellableCounts() {
        CatalogReadService catalog = mock(CatalogReadService.class);
        when(catalog.listAssistantCategorySummaries("vi")).thenReturn(List.of(
                new CatalogReadService.AssistantCategorySummary("mu-bao-hiem", "Mũ bảo hiểm", 7),
                new CatalogReadService.AssistantCategorySummary("gang-tay", "Găng tay", 0)));
        ChatToolService tools = new ChatToolService(catalog, mock(OrderReadService.class));

        ChatToolService.ToolExecution result = tools.execute(
                new ChatToolRegistry().validate(ChatToolRegistry.LIST_CATEGORIES, MAPPER.createObjectNode()),
                new ChatToolService.ToolContext("Shop bán những gì?", "vi", null, NEW_SETTINGS),
                new ChatToolService.ToolSession());

        assertThat(result.responseJson()).contains(
                "Mũ bảo hiểm", "Găng tay", "sellableProductCount", "7", "0")
                .doesNotContain("retailPrice", "salePrice", "stockState", "results");
        assertThat(result.products()).isEmpty();
        verify(catalog).listAssistantCategorySummaries("vi");
    }

    @Test
    void whatDoesTheShopSellReachesTheCategoryToolInsteadOfTheGenericGreeting() {
        ChatToolService tools = new ChatToolService(catalogWithPublicVocabulary(), mock(OrderReadService.class));

        assertThat(tools.resolveFastPath("Shop bán những gì?", "vi", null, NEW_SETTINGS)).isEmpty();
    }

    private static CatalogReadService catalogWithPublicVocabulary() {
        CatalogReadService catalog = mock(CatalogReadService.class);
        when(catalog.listAssistantCategories(any())).thenReturn(List.of(
                category("mu-bao-hiem", "Mũ bảo hiểm"),
                category("gang-tay-xe-may-moto", "Găng tay"),
                category("mu-bao-hiem-fullface", "Mũ bảo hiểm fullface"),
                category("tai-nghe-bluetooth-mu-bao-hiem", "Tai nghe bluetooth mũ bảo hiểm")));
        when(catalog.listAssistantBrands()).thenReturn(List.of(
                brand("agv", "AGV"), brand("ls2", "LS2")));
        return catalog;
    }

    private static Brand brand(String slug, String name) {
        return new Brand(slug, slug, name, null, null, null, null, null,
                true, false, null, null, null);
    }

    private static Category category(String slug, String name) {
        return new Category(slug, slug, null, name, null, null, null, null, null,
                null, null, null, true, false, null, null, null, null, null, null);
    }

    private static Product product(String slug, String name, BigDecimal retailPrice) {
        return new Product(
                "product-" + slug,
                "SKU-" + slug,
                slug,
                null,
                name,
                null,
                null,
                null,
                null,
                List.of(),
                null,
                List.of(),
                List.of(),
                new ProductPrice(retailPrice, null, "VND"),
                List.of(),
                ProductStockState.IN_STOCK,
                Boolean.TRUE,
                PublishStatus.PUBLISHED,
                false,
                null,
                HomepageBlock.NONE,
                null,
                null,
                null,
                List.of(),
                List.of(),
                ProductHighlights.EMPTY,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                List.of(),
                List.of(),
                null,
                null,
                null,
                null,
                null,
                Instant.now(),
                Instant.now());
    }

    private record SearchCase(
            String question,
            String modelCategory,
            String modelQuery,
            String expectedCategory,
            Long expectedMinPrice
    ) {}
}
