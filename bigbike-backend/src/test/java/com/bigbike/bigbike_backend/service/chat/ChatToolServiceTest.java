package com.bigbike.bigbike_backend.service.chat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;

import com.bigbike.bigbike_backend.api.chat.dto.ChatContactResponse;
import com.bigbike.bigbike_backend.domain.catalog.Brand;
import com.bigbike.bigbike_backend.domain.catalog.Category;
import com.bigbike.bigbike_backend.domain.catalog.Product;
import com.bigbike.bigbike_backend.domain.catalog.ProductHighlights;
import com.bigbike.bigbike_backend.domain.catalog.ProductPrice;
import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.domain.catalog.ProductVariant;
import com.bigbike.bigbike_backend.domain.catalog.ProductVariantOption;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.domain.catalog.SizeGuideSection;
import com.bigbike.bigbike_backend.service.catalog.CatalogReadService;
import com.bigbike.bigbike_backend.service.common.PageResult;
import com.bigbike.bigbike_backend.service.order.OrderReadService;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class ChatToolServiceTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Test
    @DisplayName("get_my_orders refuses a guest before the order service can run")
    void guestOrderQuestionNeverReadsOrders() {
        CatalogReadService catalog = mock(CatalogReadService.class);
        OrderReadService orders = mock(OrderReadService.class);
        ChatToolService tools = new ChatToolService(catalog, orders);
        ChatAssistantSettings.Snapshot settings = new ChatAssistantSettings.Snapshot(
                true,
                60,
                "Xin chào",
                List.of("A", "B", "C"),
                new ChatContactResponse("0900", "", "", "", ""),
                "", "", "");

        ChatToolService.ToolOutcome outcome = tools.resolve(
                "Kiểm tra đơn hàng của tôi", "vi", null, settings);

        assertThat(outcome.aiRequired()).isFalse();
        assertThat(outcome.localAnswer()).contains("đăng nhập").doesNotContain("địa chỉ");
        verifyNoInteractions(orders);
    }

    @Test
    @DisplayName("greeting and general help do not trigger a product search")
    void greetingHelpStaysGeneral() {
        CatalogReadService catalog = mock(CatalogReadService.class);
        OrderReadService orders = mock(OrderReadService.class);
        ChatToolService tools = new ChatToolService(catalog, orders);

        assertThat(tools.resolve("Xin chào", "vi", null, settings()).localAnswer())
                .contains("trợ lý ảo");
        assertThat(tools.resolve("Tôi muốn được tư vấn", "vi", null, settings()).localAnswer())
                .contains("tìm sản phẩm");
        verifyNoInteractions(catalog, orders);

        when(catalog.listProducts(anyInt(), anyInt(), any(), any(), any(), any(), any(), any(),
                any(), any(), any(), any()))
                .thenReturn(new PageResult<>(List.of(), 1, 10, 0, 0));
        assertThat(tools.resolve("Tôi muốn được tư vấn mũ", "vi", null, settings()).aiRequired())
                .isFalse();
        verify(catalog, atLeastOnce()).listProducts(anyInt(), anyInt(), any(), any(), any(), any(),
                any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("greeting, news and ambiguous comparison or budget requests are deterministic fast paths")
    void nonCatalogConversationDoesNotFallIntoProductSearch() {
        CatalogReadService catalog = mock(CatalogReadService.class);
        ChatToolService tools = new ChatToolService(catalog, mock(OrderReadService.class));

        ChatToolService.ToolOutcome help = tools.resolveFastPath(
                "Bạn có thể giúp tôi những gì?", "vi", null, settings()).orElseThrow();
        assertThat(help.localAnswer()).contains("em", "anh/chị");

        ChatToolService.ToolOutcome news = tools.resolveFastPath(
                "có những bài tin tức nào", "vi", null, settings()).orElseThrow();
        assertThat(news.offTopic()).isTrue();
        assertThat(news.localAnswer()).contains("ngoài phạm vi");

        assertThat(tools.resolveFastPath("So sánh các mẫu", "vi", null, settings())
                .orElseThrow().localAnswer()).contains("hai hoặc ba mẫu nào");
        assertThat(tools.resolveFastPath("Đổi ngân sách", "vi", null, settings())
                .orElseThrow().localAnswer()).contains("tầm giá nào");
        verifyNoInteractions(catalog);
    }

    @Test
    @DisplayName("latest order returns exactly one minimal, translated summary")
    void latestOrderReturnsOneSafeSummary() {
        CatalogReadService catalog = mock(CatalogReadService.class);
        OrderReadService orders = mock(OrderReadService.class);
        UUID customerId = UUID.randomUUID();
        when(orders.listCustomerOrderSummaries(customerId, 1)).thenReturn(List.of(
                new OrderReadService.CustomerOrderSummary(
                        "BB-TEST01", "CANCELLED", Instant.parse("2026-08-09T03:00:00Z"),
                        Instant.parse("2026-08-09T03:01:00Z"), BigDecimal.valueOf(1_590_000), "VND"),
                new OrderReadService.CustomerOrderSummary(
                        "BB-TEST02", "COMPLETED", Instant.parse("2026-08-08T03:00:00Z"),
                        Instant.parse("2026-08-08T03:01:00Z"), BigDecimal.valueOf(2_000_000), "VND")));

        ChatToolService.ToolOutcome outcome = new ChatToolService(catalog, orders).resolve(
                "Cho tôi biết 1 đơn hàng gần đây nhất", "vi", customerId, settings());

        assertThat(outcome.localAnswer())
                .contains("BB-TEST01", "Đã huỷ", "09/08/2026", "1.590.000 ₫")
                .doesNotContain("BB-TEST02", "CANCELLED", "COMPLETED", "VND", "địa chỉ", "sản phẩm");
        verify(orders).listCustomerOrderSummaries(customerId, 1);
    }

    @Test
    @DisplayName("plural recent-order wording requests at most five summaries")
    void pluralRecentOrdersUsesPluralCardinality() {
        CatalogReadService catalog = mock(CatalogReadService.class);
        OrderReadService orders = mock(OrderReadService.class);
        UUID customerId = UUID.randomUUID();
        when(orders.listCustomerOrderSummaries(customerId, 5)).thenReturn(List.of());

        new ChatToolService(catalog, orders).resolve(
                "Các đơn hàng gần đây của tôi", "vi", customerId, settings());

        verify(orders).listCustomerOrderSummaries(customerId, 5);
    }

    @Test
    @DisplayName("get_my_orders executor uses only server customer context and the minimal projection")
    void orderToolUsesServerContextAndMinimalResponse() {
        CatalogReadService catalog = mock(CatalogReadService.class);
        OrderReadService orders = mock(OrderReadService.class);
        UUID serverCustomerId = UUID.randomUUID();
        when(orders.listCustomerOrderSummaries(serverCustomerId, 1)).thenReturn(List.of(
                new OrderReadService.CustomerOrderSummary(
                        "BB-SAFE-01", "PROCESSING", Instant.parse("2026-08-10T02:00:00Z"),
                        Instant.parse("2026-08-10T01:59:00Z"), BigDecimal.valueOf(2_500_000), "VND"),
                new OrderReadService.CustomerOrderSummary(
                        "BB-MUST-NOT-LEAK", "PENDING", Instant.now(), Instant.now(),
                        BigDecimal.ONE, "VND")));
        ChatToolService tools = new ChatToolService(catalog, orders);
        ChatToolRegistry.ValidatedCall call = new ChatToolRegistry().validate(
                ChatToolRegistry.GET_MY_ORDERS,
                MAPPER.valueToTree(Map.of("scope", "latest")));

        ChatToolService.ToolExecution result = tools.execute(
                call,
                new ChatToolService.ToolContext(
                        "Đơn gần nhất của tôi", "vi", serverCustomerId, settings()),
                new ChatToolService.ToolSession());

        assertThat(result.responseJson())
                .contains("BB-SAFE-01", "PROCESSING", "totalAmount", "currency")
                .doesNotContain("BB-MUST-NOT-LEAK", "address", "lineItem", "payment", "email", "phone");
        assertThat(result.actions()).extracting(action -> action.type())
                .containsExactly("ORDER_HISTORY");
        verify(orders).listCustomerOrderSummaries(serverCustomerId, 1);
        verifyNoInteractions(catalog);
    }

    @Test
    @DisplayName("A valid tool name still cannot read unrelated data")
    void validButUngroundedToolsNeverReachServices() {
        CatalogReadService catalog = mock(CatalogReadService.class);
        OrderReadService orders = mock(OrderReadService.class);
        ChatToolService tools = new ChatToolService(catalog, orders);
        ChatToolRegistry registry = new ChatToolRegistry();
        ChatToolService.ToolContext productQuestion = new ChatToolService.ToolContext(
                "Tìm mũ Tanami", "vi", UUID.randomUUID(), settings());

        assertThatThrownBy(() -> tools.execute(
                registry.validate(ChatToolRegistry.GET_MY_ORDERS,
                        MAPPER.valueToTree(Map.of("scope", "latest"))),
                productQuestion,
                new ChatToolService.ToolSession()))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> tools.execute(
                registry.validate(ChatToolRegistry.GET_POLICY,
                        MAPPER.valueToTree(Map.of("topic", "warranty"))),
                productQuestion,
                new ChatToolService.ToolSession()))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> tools.execute(
                registry.validate(ChatToolRegistry.GET_SHOP_INFO, MAPPER.createObjectNode()),
                productQuestion,
                new ChatToolService.ToolSession()))
                .isInstanceOf(IllegalArgumentException.class);

        verifyNoInteractions(catalog, orders);
    }

    @Test
    @DisplayName("a model cannot turn a product name into an unverified get_product slug")
    void inferredSlugIsRejectedUntilSearchVerifiesIt() {
        CatalogReadService catalog = mock(CatalogReadService.class);
        ChatToolService tools = new ChatToolService(catalog, mock(OrderReadService.class));
        ChatToolRegistry.ValidatedCall call = new ChatToolRegistry().validate(
                ChatToolRegistry.GET_PRODUCT,
                MAPPER.valueToTree(Map.of("slug", "mu-bao-hiem-fullface-agv-k3")));

        assertThatThrownBy(() -> tools.execute(
                call,
                new ChatToolService.ToolContext(
                        "Mũ AGV K3 có size và màu nào?", "vi", null, settings()),
                new ChatToolService.ToolSession()))
                .isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(catalog);
    }

    @Test
    @DisplayName("a server-seeded recent card slug permits one direct get_product lookup")
    void recentVerifiedSlugPermitsDirectProductLookup() {
        CatalogReadService catalog = mock(CatalogReadService.class);
        Product product = product(
                "mu-bao-hiem-fullface-agv-k3",
                "Mũ bảo hiểm fullface AGV K3",
                BigDecimal.valueOf(7_200_000),
                List.of(sizeVariant("M")));
        when(catalog.getProductBySlug("mu-bao-hiem-fullface-agv-k3", "vi")).thenReturn(product);
        ChatToolService tools = new ChatToolService(catalog, mock(OrderReadService.class));
        ChatToolRegistry.ValidatedCall call = new ChatToolRegistry().validate(
                ChatToolRegistry.GET_PRODUCT,
                MAPPER.valueToTree(Map.of("slug", "mu-bao-hiem-fullface-agv-k3")));

        ChatToolService.ToolExecution result = tools.execute(
                call,
                new ChatToolService.ToolContext("Mẫu này còn hàng không?", "vi", null, settings()),
                new ChatToolService.ToolSession(List.of("mu-bao-hiem-fullface-agv-k3")));

        assertThat(result.products()).extracting(card -> card.slug())
                .containsExactly("mu-bao-hiem-fullface-agv-k3");
        verify(catalog).getProductBySlug("mu-bao-hiem-fullface-agv-k3", "vi");
    }

    @Test
    @DisplayName("variant attribute normalization ignores case and Vietnamese diacritics")
    void normalizerRemovesCaseAndDiacritics() {
        assertThat(ChatToolService.normalize("MÀU SẮC")).isEqualTo("mau sac");
        assertThat(ChatToolService.normalize("Size")).isEqualTo("size");
        assertThat(ChatToolService.normalize("MODEL")).isEqualTo("model");
    }

    @Test
    @DisplayName("CHAT_RULE_017: variant questions keep the AGV model and detail lookup")
    void variantQuestionKeepsProductMatchAndDetailLookup() {
        CatalogReadService catalog = mock(CatalogReadService.class);
        Product listing = product(
                "mu-bao-hiem-fullface-agv-k3",
                "Mũ bảo hiểm fullface AGV K3",
                BigDecimal.valueOf(7_200_000),
                List.of());
        Product detail = product(
                "mu-bao-hiem-fullface-agv-k3",
                "Mũ bảo hiểm fullface AGV K3",
                BigDecimal.valueOf(7_200_000),
                List.of(sizeVariant("M"), sizeVariant("L"), sizeVariant("XL")));
        when(catalog.searchProductsForAssistant(any(), any(), any(), any(), any(), any(), anyInt(), any()))
                .thenReturn(List.of(listing));
        when(catalog.getProductBySlug("mu-bao-hiem-fullface-agv-k3", "vi"))
                .thenReturn(detail);
        ChatToolService tools = new ChatToolService(catalog, mock(OrderReadService.class));

        for (String question : List.of(
                "Mũ AGV K3 có size và màu nào?",
                "mu agv k3 co size va mau nao?")) {
            assertThat(ChatToolService.extractProductQuery(question).identifiers())
                    .as(question)
                    .containsExactly("k3");

            ChatToolService.ToolOutcome outcome = tools.resolve(
                    question, "vi", null, settings());

            assertThat(outcome.products()).extracting(card -> card.slug())
                    .as(question)
                    .containsExactly("mu-bao-hiem-fullface-agv-k3");
            assertThat(outcome.toolJson())
                    .contains("\"detailTool\":\"get_product\"", "\"size\":[\"M\",\"L\",\"XL\"]")
                    .doesNotContain("\"color\":[");
        }

        verify(catalog, times(2)).getProductBySlug("mu-bao-hiem-fullface-agv-k3", "vi");
    }

    @Test
    @DisplayName("AGV K3 size and colour answer is terminal, verified and limited to sellable variants")
    void exactVariantQuestionUsesVerifiedTerminalToolAnswer() {
        CatalogReadService catalog = mock(CatalogReadService.class);
        Product listing = product(
                "mu-bao-hiem-fullface-agv-k3",
                "Mũ bảo hiểm fullface AGV K3",
                BigDecimal.valueOf(7_200_000),
                List.of());
        Product detail = product(
                "mu-bao-hiem-fullface-agv-k3",
                "Mũ bảo hiểm fullface AGV K3",
                BigDecimal.valueOf(7_200_000),
                List.of(
                        variant(true, "Màu sắc", "Đen", "Size", "M"),
                        variant(true, "Màu sắc", "Trắng", "Size", "L"),
                        variant(false, "Màu sắc", "Đỏ", "Size", "XL")));
        when(catalog.listAssistantBrands()).thenReturn(List.of(brand("agv", "AGV")));
        when(catalog.searchProductsForAssistant(any(), any(), any(), any(), any(), any(), anyInt(), any()))
                .thenReturn(List.of(listing));
        when(catalog.getProductBySlug("mu-bao-hiem-fullface-agv-k3", "vi")).thenReturn(detail);
        ChatToolService tools = new ChatToolService(catalog, mock(OrderReadService.class));
        ChatToolRegistry registry = new ChatToolRegistry();
        ChatToolRegistry.ValidatedCall call = registry.validate(ChatToolRegistry.SEARCH_PRODUCTS,
                MAPPER.valueToTree(Map.of("query", "K3", "lang", "vi")));

        ChatToolService.ToolExecution result = tools.execute(
                call,
                new ChatToolService.ToolContext("Mũ AGV K3 có size và màu nào?", "vi", null, settings()),
                new ChatToolService.ToolSession());

        assertThat(result.terminalAnswer()).isNotNull();
        assertThat(result.terminalAnswer().answer())
                .contains("Anh/chị", "Các size đang bán là M, L", "Các màu đang bán là Đen, Trắng")
                .doesNotContain("Đỏ", "XL", "OUT_OF_STOCK");
        assertThat(result.products()).extracting(card -> card.slug())
                .containsExactly("mu-bao-hiem-fullface-agv-k3");
    }

    @Test
    @DisplayName("technical facts and size guidance use different verified product fields")
    void productDetailIntentSeparatesTechnicalFactsFromSizeGuidance() {
        CatalogReadService catalog = mock(CatalogReadService.class);
        Product listing = product(
                "mu-bao-hiem-fullface-ilm-mf509",
                "Mũ bảo hiểm fullface ILM MF509",
                BigDecimal.valueOf(5_850_000),
                List.of());
        Product detail = productWithDetails(
                listing,
                "Cân cỡ L kèm kính nặng 1.567g. Chuẩn DOT FMVSS 218 và ECE 22.06. "
                        + "Có 4 khe lấy gió và 3 khe thoát gió.",
                null,
                SizeGuideSection.builder().html(
                        "<p>S 55–56 cm</p><p>M 57–58 cm</p><p>L 59–60 cm</p>").build(),
                List.of(sizeVariant("L"), sizeVariant("M"), sizeVariant("S")));
        when(catalog.searchProductsForAssistant(any(), any(), any(), any(), any(), any(), anyInt(), any()))
                .thenReturn(List.of(listing));
        when(catalog.getProductBySlug("mu-bao-hiem-fullface-ilm-mf509", "vi")).thenReturn(detail);
        ChatToolService tools = new ChatToolService(catalog, mock(OrderReadService.class));
        ChatToolRegistry registry = new ChatToolRegistry();

        assertThat(tools.resolveFastPath(
                "Mũ bảo hiểm fullface ILM MF509 có bảng size là gì", "vi", null, settings())).isEmpty();

        ChatToolService.ToolExecution technical = tools.execute(
                registry.validate(ChatToolRegistry.SEARCH_PRODUCTS,
                        MAPPER.valueToTree(Map.of("query", "MF509", "lang", "vi"))),
                new ChatToolService.ToolContext(
                        "Mũ bảo hiểm fullface ILM MF509 có thông số kỹ thuật là gì", "vi", null, settings()),
                new ChatToolService.ToolSession());
        ChatToolService.ToolExecution size = tools.execute(
                registry.validate(ChatToolRegistry.SEARCH_PRODUCTS,
                        MAPPER.valueToTree(Map.of("query", "MF509", "lang", "vi"))),
                new ChatToolService.ToolContext(
                        "Mũ bảo hiểm fullface ILM MF509 có bảng size là gì", "vi", null, settings()),
                new ChatToolService.ToolSession());

        assertThat(technical.terminalAnswer()).isNotNull();
        assertThat(technical.terminalAnswer().answer())
                .contains("1.567g", "DOT FMVSS 218", "ECE 22.06", "4 khe lấy gió")
                .doesNotContain("Các size đang bán", "Bảng size đã lưu");
        assertThat(size.terminalAnswer()).isNotNull();
        assertThat(size.terminalAnswer().answer())
                .contains("Các size đang bán là S, M, L", "S 55–56 cm", "M 57–58 cm", "L 59–60 cm")
                .doesNotContain("DOT FMVSS 218", "1.567g");
        assertThat(size.terminalAnswer().answer()).isNotEqualTo(technical.terminalAnswer().answer());
    }

    @Test
    @DisplayName("one recent product resolves pronouns with sizes and technical facts from stored detail")
    void recentSingleProductResolvesPronounsWithoutHeadingFragmentsOrRepeatedAnswer() {
        CatalogReadService catalog = mock(CatalogReadService.class);
        String slug = "mu-bao-hiem-fullface-retro-ilm-z503";
        Product listing = product(
                slug,
                "Mũ bảo hiểm fullface retro ILM Z503",
                BigDecimal.valueOf(2_450_000),
                List.of());
        Product z503 = productWithDetails(
                listing,
                "<h3>TIÊU CHUẨN AN TOÀN</h3><p>Đạt chuẩn DOT và FMVSS 218.</p>"
                        + "<p>Vỏ ABS giúp hạn chế va đập.</p><p>Lớp xốp EPS hỗ trợ hấp thụ lực.</p>",
                "",
                null,
                List.of(sizeVariant("S"), sizeVariant("M"), sizeVariant("L"),
                        sizeVariant("XL"), sizeVariant("XXL")));
        when(catalog.getProductBySlug(slug, "vi")).thenReturn(z503);
        ChatToolService tools = new ChatToolService(catalog, mock(OrderReadService.class));
        ChatToolService.ConversationContext context = new ChatToolService.ConversationContext(
                "mu-bao-hiem", "ilm", null, null, List.of(slug), false);

        ChatToolService.ToolOutcome technical = tools.resolveFastPath(
                "Sản phẩm này có thông số kỹ thuật gì?", "vi", null, settings(), context).orElseThrow();
        ChatToolService.ToolOutcome sizes = tools.resolveFastPath(
                "Mẫu này có size nào?", "vi", null, settings(), context).orElseThrow();
        ChatToolService.ToolOutcome confirmation = tools.resolveFastPath(
                "Vậy size như trên đúng không?", "vi", null, settings(), context).orElseThrow();

        assertThat(technical.localAnswer())
                .contains("DOT", "FMVSS 218", "ABS", "EPS")
                .doesNotContain("TIÊU CHUẨN AN TOÀN")
                .doesNotEndWith("TIÊU CHUẨN AN TOÀN.");
        assertThat(sizes.localAnswer())
                .contains("S, M, L, XL, XXL", "chưa có bảng size theo số đo");
        assertThat(confirmation.localAnswer())
                .contains("Dạ, đúng rồi", "chưa có bảng size theo số đo")
                .isNotEqualTo(sizes.localAnswer());
        assertThat(technical.products()).extracting(card -> card.slug()).containsExactly(slug);
    }

    @Test
    @DisplayName("saved specifications take priority over sales-description technical copy")
    void technicalFactsDoNotMixDescriptionWhenSpecificationsArePresent() {
        CatalogReadService catalog = mock(CatalogReadService.class);
        String slug = "mu-bao-hiem-fullface-ilm-priority";
        Product listing = product(
                slug,
                "Mũ bảo hiểm fullface ILM Priority",
                BigDecimal.valueOf(2_450_000),
                List.of());
        Product detail = productWithDetails(
                listing,
                "<p>Đạt chuẩn DOT và FMVSS 218.</p><p>Vỏ ABS và lớp xốp EPS.</p>",
                "<p>Trọng lượng 1.250 g.</p>",
                null,
                List.of(sizeVariant("M")));
        when(catalog.getProductBySlug(slug, "vi")).thenReturn(detail);
        ChatToolService tools = new ChatToolService(catalog, mock(OrderReadService.class));
        ChatToolService.ConversationContext context = new ChatToolService.ConversationContext(
                "mu-bao-hiem", "ilm", null, null, List.of(slug), false);

        ChatToolService.ToolOutcome outcome = tools.resolveFastPath(
                "Sản phẩm này có thông số kỹ thuật gì?", "vi", null, settings(), context).orElseThrow();

        assertThat(outcome.localAnswer())
                .contains("1.250 g")
                .doesNotContain("DOT", "FMVSS", "ABS", "EPS");
    }

    @Test
    @DisplayName("multiple recent cards ask the customer to choose rather than guessing a pronoun")
    void multipleRecentProductsAskForTheProductName() {
        CatalogReadService catalog = mock(CatalogReadService.class);
        Product first = product("mu-a", "Mũ A", BigDecimal.valueOf(1_500_000), List.of());
        Product second = product("mu-b", "Mũ B", BigDecimal.valueOf(1_700_000), List.of());
        when(catalog.getProductBySlug("mu-a", "vi")).thenReturn(first);
        when(catalog.getProductBySlug("mu-b", "vi")).thenReturn(second);
        ChatToolService tools = new ChatToolService(catalog, mock(OrderReadService.class));
        ChatToolService.ConversationContext context = new ChatToolService.ConversationContext(
                "mu-bao-hiem", null, null, null, List.of("mu-a", "mu-b"), false);

        ChatToolService.ToolOutcome outcome = tools.resolveFastPath(
                "Cái này có size nào?", "vi", null, settings(), context).orElseThrow();

        assertThat(outcome.localAnswer()).contains("Mũ A", "Mũ B", "đúng tên mẫu");
        assertThat(outcome.products()).isEmpty();
    }

    @Test
    @DisplayName("colour values are humanized for chat and unsafe internal values are omitted")
    void colourValuesAreSanitizedBeforeChatDisplay() {
        assertThat(ChatToolService.normalizeColorForDisplay("CYBORG BLUE")).isEqualTo("Cyborg Blue");
        assertThat(ChatToolService.normalizeColorForDisplay("ronin-red")).isEqualTo("Ronin Red");
        assertThat(ChatToolService.normalizeColorForDisplay("den-nham-3")).isEqualTo("Đen Nhám 3");
        assertThat(ChatToolService.normalizeColorForDisplay("variant-id-123")).isNull();

        ProductVariant rawColour = variant(true, "Màu sắc", "ronin-red", "Size", "M");
        assertThat(ChatToolService.normalizedAvailableVariants(List.of(rawColour)))
                .containsExactly(Map.of("color", "Ronin Red", "size", "M"));
    }

    @Test
    @DisplayName("an exact missing model returns a verified no-match terminal answer without substitutes")
    void exactMissingModelEndsAtVerifiedNoMatch() {
        CatalogReadService catalog = mock(CatalogReadService.class);
        when(catalog.searchProductsForAssistant(any(), any(), any(), any(), any(), any(), anyInt(), any()))
                .thenReturn(List.of());
        ChatToolService tools = new ChatToolService(catalog, mock(OrderReadService.class));
        ChatToolRegistry.ValidatedCall call = new ChatToolRegistry().validate(
                ChatToolRegistry.SEARCH_PRODUCTS,
                MAPPER.valueToTree(Map.of("query", "xqz-no-such-model", "lang", "vi")));

        ChatToolService.ToolExecution result = tools.execute(
                call,
                new ChatToolService.ToolContext(
                        "tôi muốn tìm mũ xqz-no-such-model", "vi", null, settings()),
                new ChatToolService.ToolSession());

        assertThat(result.products()).isEmpty();
        assertThat(result.terminalAnswer()).isNotNull();
        assertThat(result.terminalAnswer().handoffRecommended()).isFalse();
        assertThat(result.terminalAnswer().answer()).contains("đúng mẫu", "không đổi sang sản phẩm khác");
    }

    @Test
    @DisplayName("the budget quick prompt asks for a price range without calling AI or catalog")
    void budgetPromptAlwaysClarifiesThePriceRange() {
        CatalogReadService catalog = mock(CatalogReadService.class);
        ChatToolService tools = new ChatToolService(catalog, mock(OrderReadService.class));

        for (String question : List.of(
                "Tìm mũ bảo hiểm theo ngân sách",
                "Tim mu bao hiem theo ngan sach")) {
            ChatToolService.ToolOutcome outcome = tools.resolve(
                    question, "vi", null, settings());

            assertThat(outcome.aiRequired()).as(question).isFalse();
            assertThat(outcome.products()).as(question).isEmpty();
            assertThat(outcome.localAnswer()).as(question).contains("tầm giá nào");
        }

        verifyNoInteractions(catalog);
    }

    @Test
    @DisplayName("a headset price request keeps the headset category and never substitutes a camera")
    void headsetPriceRequestNeverLeaksIntoCameraResults() {
        CatalogReadService catalog = mock(CatalogReadService.class);
        Product headset = product(
                "tai-nghe-roadfox", "Tai nghe Bluetooth RoadFox", BigDecimal.valueOf(2_000_000), List.of());
        Product camera = product(
                "camera-roadfox", "Camera hành trình RoadFox", BigDecimal.valueOf(2_000_000), List.of());
        when(catalog.listProducts(anyInt(), anyInt(), any(), any(), any(), any(), any(), any(),
                any(), any(), any(), any()))
                .thenAnswer(invocation -> new PageResult<>(
                        "tai-nghe-bluetooth-mu-bao-hiem".equals(invocation.getArgument(3))
                                ? List.of(headset) : List.of(camera),
                        1, 10, 1, 1));

        ChatToolService.ToolOutcome outcome = new ChatToolService(catalog, mock(OrderReadService.class))
                .resolve("tai nghe dưới 3 triệu", "vi", null, settings());

        assertThat(outcome.products()).extracting(card -> card.name())
                .containsExactly("Tai nghe Bluetooth RoadFox")
                .doesNotContain("Camera hành trình RoadFox");
        verify(catalog, atLeastOnce()).listProducts(anyInt(), anyInt(), any(),
                org.mockito.ArgumentMatchers.eq("tai-nghe-bluetooth-mu-bao-hiem"), any(), any(), any(), any(),
                any(), any(), any(), any());
    }

    @Test
    @DisplayName("helmet discovery uses the helmet category and never returns name-matched accessories")
    void helmetPriceRequestNeverLeaksIntoHelmetAccessories() {
        CatalogReadService catalog = mock(CatalogReadService.class);
        Product helmet = product(
                "mu-fullface-safe", "Mũ bảo hiểm fullface Safe", BigDecimal.valueOf(1_590_000), List.of());
        Product accessory = product(
                "khan-trum-dau", "Khăn trùm nửa đầu đội mũ bảo hiểm", BigDecimal.valueOf(300_000), List.of());
        when(catalog.listProducts(anyInt(), anyInt(), any(), any(), any(), any(), any(), any(),
                any(), any(), any(), any()))
                .thenAnswer(invocation -> new PageResult<>(
                        "mu-bao-hiem".equals(invocation.getArgument(3))
                                ? List.of(helmet) : List.of(accessory),
                        1,
                        10,
                        1,
                        1));

        ChatToolService.ToolOutcome outcome = new ChatToolService(catalog, mock(OrderReadService.class))
                .resolve("Mũ bảo hiểm dưới 2 tr", "vi", null, settings());

        assertThat(outcome.products()).extracting(card -> card.name())
                .containsExactly("Mũ bảo hiểm fullface Safe")
                .doesNotContain("Khăn trùm nửa đầu đội mũ bảo hiểm");
        verify(catalog, atLeastOnce()).listProducts(anyInt(), anyInt(), any(),
                org.mockito.ArgumentMatchers.eq("mu-bao-hiem"), any(), any(), any(), any(),
                any(), any(), any(), any());
    }

    @Test
    @DisplayName("a short price follow-up keeps the previously saved helmet category")
    void priceFollowUpUsesMinimalConversationCatalogContext() {
        CatalogReadService catalog = mock(CatalogReadService.class);
        List<Product> helmets = List.of(
                product("mu-follow-1", "Mũ fullface Follow 1", BigDecimal.valueOf(1_500_000), List.of()),
                product("mu-follow-2", "Mũ fullface Follow 2", BigDecimal.valueOf(2_000_000), List.of()),
                product("mu-follow-3", "Mũ fullface Follow 3", BigDecimal.valueOf(2_500_000), List.of()));
        Product accessory = product(
                "gia-camera", "Giá gắn camera mũ bảo hiểm", BigDecimal.valueOf(1_000_000), List.of());
        when(catalog.listProducts(anyInt(), anyInt(), any(), any(), any(), any(), any(), any(),
                any(), any(), any(), any()))
                .thenAnswer(invocation -> new PageResult<>(
                        "mu-bao-hiem".equals(invocation.getArgument(3)) ? helmets : List.of(accessory),
                        1,
                        10,
                        3,
                        1));
        ChatToolService tools = new ChatToolService(catalog, mock(OrderReadService.class));
        ChatToolService.ConversationContext context = new ChatToolService.ConversationContext(
                "mu-bao-hiem", null, null, null, List.of("mu-before"), false);

        ChatToolService.ToolOutcome outcome = tools.resolve(
                "Cho tôi 3 sản phẩm dưới 3 tr", "vi", null, settings(), context);

        assertThat(outcome.products()).hasSize(3);
        assertThat(outcome.products()).extracting(card -> card.slug())
                .containsExactly("mu-follow-1", "mu-follow-2", "mu-follow-3")
                .doesNotContain("gia-camera");
        verify(catalog, atLeastOnce()).listProducts(anyInt(), anyInt(), any(),
                org.mockito.ArgumentMatchers.eq("mu-bao-hiem"), any(), any(), any(), any(),
                any(), any(), any(), any());
    }

    @Test
    @DisplayName("CHAT_RULE_018: changing category clears inherited price and brand filters")
    void categoryFollowUpClearsSavedFiltersBeforeSearchingTheNewCategory() {
        CatalogReadService catalog = mock(CatalogReadService.class);
        Product headset = product(
                "scs-s10x", "Tai nghe mũ bảo hiểm intercom SCS S10X",
                BigDecimal.valueOf(1_550_000), List.of());
        when(catalog.listAssistantCategories(any())).thenReturn(List.of(
                category("mu-bao-hiem", "Mũ bảo hiểm"),
                category("tai-nghe-bluetooth-mu-bao-hiem", "Tai nghe bluetooth mũ bảo hiểm")));
        when(catalog.listProducts(anyInt(), anyInt(), any(), any(), any(), any(), any(), any(),
                any(), any(), any(), any()))
                .thenAnswer(invocation -> new PageResult<>(
                        "tai-nghe-bluetooth-mu-bao-hiem".equals(invocation.getArgument(3))
                                ? List.of(headset) : List.of(),
                        1, 10, 1, 1));
        ChatToolService tools = new ChatToolService(catalog, mock(OrderReadService.class));
        ChatToolService.ConversationContext context = new ChatToolService.ConversationContext(
                "mu-bao-hiem", null, 1_000_000L, 2_000_000L, List.of("mu-before"), false);
        ChatToolRegistry.ValidatedCall call = new ChatToolRegistry().validate(
                ChatToolRegistry.SEARCH_PRODUCTS,
                MAPPER.valueToTree(Map.of(
                        "category", "tai-nghe-bluetooth-mu-bao-hiem", "lang", "vi")));

        ChatToolService.ToolExecution result = tools.execute(
                call,
                new ChatToolService.ToolContext("còn tai nghe thì sao", "vi", null, settings(), context),
                new ChatToolService.ToolSession());

        assertThat(result.products()).extracting(card -> card.slug()).containsExactly("scs-s10x");
        assertThat(result.terminalAnswer()).isNotNull();
        assertThat(result.terminalAnswer().answer())
                .contains("shop hiện có 1 mẫu tai nghe", "hiển thị đầy đủ 1 thẻ")
                .doesNotContain("đã nêu trước đó", "tầm giá này");
        assertThat(result.requiredDisclosures()).isEmpty();
        assertThat(new ChatResponseGuard().check(
                result.terminalAnswer().answer(),
                result.products(),
                "vi",
                result.requiredDisclosures(),
                result.catalogTotals())).isPresent();
        verify(catalog, atLeastOnce()).listProducts(anyInt(), anyInt(), any(),
                org.mockito.ArgumentMatchers.eq("tai-nghe-bluetooth-mu-bao-hiem"), any(), any(), any(), any(),
                org.mockito.ArgumentMatchers.isNull(), org.mockito.ArgumentMatchers.isNull(),
                any(), any());
    }

    @Test
    @DisplayName("recorded context drops old brand, price and card slugs when the category changes")
    void categoryChangeClearsStaleConversationFilters() {
        ChatToolService tools = new ChatToolService(mock(CatalogReadService.class), mock(OrderReadService.class));
        ChatToolService.ConversationContext prior = new ChatToolService.ConversationContext(
                "mu-bao-hiem", "ilm", 3_000_000L, 5_000_000L,
                List.of("mu-bao-hiem-fullface-retro-ilm-z503"), false);
        List<com.bigbike.bigbike_backend.api.chat.dto.ChatProductCardResponse> cards = List.of(
                new com.bigbike.bigbike_backend.api.chat.dto.ChatProductCardResponse(
                        "tai-nghe-s12", "Tai nghe S12", null, BigDecimal.valueOf(3_500_000),
                        null, "VND", "IN_STOCK"));

        ChatToolService.ConversationContext updated = tools.recordConversationContext(
                prior,
                "Cho tôi xem tai nghe",
                "vi",
                cards,
                List.of(),
                new ChatToolService.SearchScope(
                        "tai-nghe-bluetooth-mu-bao-hiem", null, null, null));

        assertThat(updated.category()).isEqualTo("tai-nghe-bluetooth-mu-bao-hiem");
        assertThat(updated.brand()).isNull();
        assertThat(updated.minPrice()).isNull();
        assertThat(updated.maxPrice()).isNull();
        assertThat(updated.productSlugs()).containsExactly("tai-nghe-s12");
    }

    @Test
    @DisplayName("an empty inherited price filter retries the current scope with a clear disclosure")
    void emptyInheritedPriceFilterIsDroppedForOneDisclosedRetry() {
        CatalogReadService catalog = mock(CatalogReadService.class);
        Product headset = product("tai-nghe-s12", "Tai nghe S12", BigDecimal.valueOf(3_500_000), List.of());
        when(catalog.listAssistantCategories(any())).thenReturn(List.of(
                category("tai-nghe-bluetooth-mu-bao-hiem", "Tai nghe bluetooth mũ bảo hiểm")));
        when(catalog.listProducts(anyInt(), anyInt(), any(), any(), any(), any(), any(), any(),
                any(), any(), any(), any()))
                .thenAnswer(invocation -> {
                    Long minPrice = invocation.getArgument(8);
                    Long maxPrice = invocation.getArgument(9);
                    return new PageResult<>(minPrice == null && maxPrice == null ? List.of(headset) : List.of(),
                            1, 10, minPrice == null && maxPrice == null ? 1 : 0, 1);
                });
        ChatToolService tools = new ChatToolService(catalog, mock(OrderReadService.class));
        ChatToolService.ConversationContext prior = new ChatToolService.ConversationContext(
                "tai-nghe-bluetooth-mu-bao-hiem", null, 1_000_000L, 2_000_000L,
                List.of("tai-nghe-cu"), false);
        ChatToolRegistry.ValidatedCall call = new ChatToolRegistry().validate(
                ChatToolRegistry.SEARCH_PRODUCTS,
                MAPPER.valueToTree(Map.of("category", "tai-nghe-bluetooth-mu-bao-hiem", "lang", "vi")));

        ChatToolService.ToolExecution result = tools.execute(
                call,
                new ChatToolService.ToolContext("còn tai nghe thì sao", "vi", null, settings(), prior),
                new ChatToolService.ToolSession());

        assertThat(result.products()).extracting(card -> card.slug()).containsExactly("tai-nghe-s12");
        assertThat(result.requiredDisclosures())
                .containsExactly(ChatToolService.RequiredDisclosure.INHERITED_FILTER_DROPPED);
        assertThat(result.terminalAnswer()).isNotNull();
        assertThat(result.terminalAnswer().answer())
                .contains("lượt trước", "bỏ riêng bộ lọc cũ", "tìm lại yêu cầu này");
        assertThat(new ChatResponseGuard().check(
                result.terminalAnswer().answer(), result.products(), "vi",
                result.requiredDisclosures(), result.catalogTotals())).isPresent();
    }

    @Test
    @DisplayName("an empty inherited brand filter retries once and is cleared from the next turn")
    void emptyInheritedBrandFilterIsDroppedForOneDisclosedRetry() {
        CatalogReadService catalog = mock(CatalogReadService.class);
        Product headset = product("tai-nghe-s12", "Tai nghe S12", BigDecimal.valueOf(3_500_000), List.of());
        when(catalog.listAssistantCategories(any())).thenReturn(List.of(
                category("tai-nghe-bluetooth-mu-bao-hiem", "Tai nghe bluetooth mũ bảo hiểm")));
        when(catalog.listProducts(anyInt(), anyInt(), any(), any(), any(), any(), any(), any(),
                any(), any(), any(), any()))
                .thenAnswer(invocation -> new PageResult<>(
                        invocation.getArgument(4) == null ? List.of(headset) : List.of(),
                        1, 10, invocation.getArgument(4) == null ? 1 : 0, 1));
        ChatToolService tools = new ChatToolService(catalog, mock(OrderReadService.class));
        ChatToolService.ConversationContext prior = new ChatToolService.ConversationContext(
                "tai-nghe-bluetooth-mu-bao-hiem", "ilm", null, null,
                List.of("tai-nghe-cu"), false);
        ChatToolRegistry.ValidatedCall call = new ChatToolRegistry().validate(
                ChatToolRegistry.SEARCH_PRODUCTS,
                MAPPER.valueToTree(Map.of(
                        "category", "tai-nghe-bluetooth-mu-bao-hiem", "lang", "vi")));

        ChatToolService.ToolExecution result = tools.execute(
                call,
                new ChatToolService.ToolContext("còn mẫu khác thì sao", "vi", null, settings(), prior),
                new ChatToolService.ToolSession());
        ChatToolService.ConversationContext updated = tools.recordConversationContext(
                prior,
                "còn mẫu khác thì sao",
                "vi",
                result.products(),
                result.actions(),
                result.searchScope());

        assertThat(result.products()).extracting(card -> card.slug()).containsExactly("tai-nghe-s12");
        assertThat(result.requiredDisclosures())
                .containsExactly(ChatToolService.RequiredDisclosure.INHERITED_FILTER_DROPPED);
        assertThat(result.terminalAnswer()).isNotNull();
        assertThat(result.terminalAnswer().answer())
                .contains("bộ lọc", "lượt trước", "bỏ riêng bộ lọc cũ", "tìm lại yêu cầu này");
        assertThat(updated.brand()).isNull();
        assertThat(updated.category()).isEqualTo("tai-nghe-bluetooth-mu-bao-hiem");
    }

    @Test
    @DisplayName("CHAT_RULE_005: a current price always replaces the saved price range")
    void currentPriceOverridesSavedPriceRange() {
        CatalogReadService catalog = mock(CatalogReadService.class);
        Product headset = product(
                "headset-under-one", "Tai nghe Bluetooth dưới một triệu",
                BigDecimal.valueOf(900_000), List.of());
        when(catalog.listAssistantCategories(any())).thenReturn(List.of(
                category("tai-nghe-bluetooth-mu-bao-hiem", "Tai nghe bluetooth mũ bảo hiểm")));
        when(catalog.listProducts(anyInt(), anyInt(), any(), any(), any(), any(), any(), any(),
                any(), any(), any(), any()))
                .thenReturn(new PageResult<>(List.of(headset), 1, 10, 1, 1));
        ChatToolService tools = new ChatToolService(catalog, mock(OrderReadService.class));
        ChatToolService.ConversationContext context = new ChatToolService.ConversationContext(
                "mu-bao-hiem", null, 1_000_000L, 2_000_000L, List.of("mu-before"), false);
        ChatToolRegistry.ValidatedCall call = new ChatToolRegistry().validate(
                ChatToolRegistry.SEARCH_PRODUCTS,
                MAPPER.valueToTree(Map.of(
                        "category", "tai-nghe-bluetooth-mu-bao-hiem",
                        "maxPrice", 1_000_000L,
                        "lang", "vi")));

        ChatToolService.ToolExecution result = tools.execute(
                call,
                new ChatToolService.ToolContext("tai nghe dưới 1tr", "vi", null, settings(), context),
                new ChatToolService.ToolSession());

        assertThat(result.products()).extracting(card -> card.slug()).containsExactly("headset-under-one");
        assertThat(result.terminalAnswer()).isNotNull();
        assertThat(result.terminalAnswer().answer())
                .contains("trong tầm giá anh/chị hỏi", "hiển thị đầy đủ 1 thẻ")
                .doesNotContain("đã nêu trước đó");
        verify(catalog, atLeastOnce()).listProducts(anyInt(), anyInt(), any(),
                org.mockito.ArgumentMatchers.eq("tai-nghe-bluetooth-mu-bao-hiem"), any(), any(), any(), any(),
                org.mockito.ArgumentMatchers.isNull(), org.mockito.ArgumentMatchers.eq(1_000_000L),
                any(), any());
    }

    @Test
    @DisplayName("CHAT_RULE_017: approved shorthand and one-character category correction stay metadata-bound")
    void shorthandAndOneCharacterCategoryCorrectionUseOnlyPublicMetadata() {
        CatalogReadService catalog = mock(CatalogReadService.class);
        Product helmet = product("mu-safe", "Mũ bảo hiểm Safe", BigDecimal.valueOf(1_500_000), List.of());
        Product headset = product("scs-s10x", "Tai nghe mũ bảo hiểm intercom SCS S10X",
                BigDecimal.valueOf(1_550_000), List.of());
        when(catalog.listAssistantCategories(any())).thenReturn(List.of(
                category("mu-bao-hiem", "Mũ bảo hiểm"),
                category("tai-nghe-bluetooth-mu-bao-hiem", "Tai nghe bluetooth mũ bảo hiểm")));
        when(catalog.listProducts(anyInt(), anyInt(), any(), any(), any(), any(), any(), any(),
                any(), any(), any(), any()))
                .thenAnswer(invocation -> new PageResult<>(switch ((String) invocation.getArgument(3)) {
                    case "mu-bao-hiem" -> List.of(helmet);
                    case "tai-nghe-bluetooth-mu-bao-hiem" -> List.of(headset);
                    default -> List.of();
                }, 1, 10, 1, 1));
        ChatToolService tools = new ChatToolService(catalog, mock(OrderReadService.class));

        for (String question : List.of("mbh dưới 2tr", "mũ bh dưới 2tr", "mu bh dưới 2tr")) {
            assertThat(tools.resolve(question, "vi", null, settings()).products())
                    .as(question)
                    .extracting(card -> card.slug()).containsExactly("mu-safe");
        }
        assertThat(tools.resolve("tai nge dưới 2tr", "vi", null, settings()).products())
                .extracting(card -> card.slug()).containsExactly("scs-s10x");
        assertThat(tools.resolve("tai nge bluetooth", "vi", null, settings()).products())
                .extracting(card -> card.slug()).containsExactly("scs-s10x");
        verify(catalog, atLeastOnce()).listProducts(anyInt(), anyInt(), any(),
                org.mockito.ArgumentMatchers.eq("mu-bao-hiem"), any(), any(), any(), any(), any(), any(), any(), any());
        verify(catalog, atLeastOnce()).listProducts(anyInt(), anyInt(), any(),
                org.mockito.ArgumentMatchers.eq("tai-nghe-bluetooth-mu-bao-hiem"), any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("CHAT_RULE_017: short code-like values are never fuzzy-corrected as a brand")
    void codeLikeValueIsNotFuzzyCorrectedAsBrand() {
        CatalogReadService catalog = mock(CatalogReadService.class);
        when(catalog.listAssistantBrands()).thenReturn(List.of(brand("ls2", "LS2")));
        when(catalog.searchProductsForAssistant(any(), any(), any(), any(), any(), any(), anyInt(), any()))
                .thenReturn(List.of());
        new ChatToolService(catalog, mock(OrderReadService.class))
                .resolve("ls3 dưới 2tr", "vi", null, settings());

        verify(catalog, atLeastOnce()).searchProductsForAssistant(
                org.mockito.ArgumentMatchers.eq(List.of("ls3")),
                org.mockito.ArgumentMatchers.isNull(),
                org.mockito.ArgumentMatchers.isNull(),
                any(), any(), any(), anyInt(), any());
        verify(catalog, never()).searchProductsForAssistant(
                any(), any(), org.mockito.ArgumentMatchers.eq("ls2"),
                any(), any(), any(), anyInt(), any());
    }

    @Test
    @DisplayName("the legacy search switch preserves strict category grounding")
    void legacySearchSwitchPreservesStrictCategoryGrounding() {
        CatalogReadService catalog = mock(CatalogReadService.class);
        Product helmet = product("mu-safe", "Mũ bảo hiểm Safe", BigDecimal.valueOf(1_500_000), List.of());
        when(catalog.listAssistantCategories(any())).thenReturn(List.of(
                category("mu-bao-hiem", "Mũ bảo hiểm"),
                category("tai-nghe-bluetooth-mu-bao-hiem", "Tai nghe bluetooth mũ bảo hiểm")));
        when(catalog.listProducts(anyInt(), anyInt(), any(), any(), any(), any(), any(), any(),
                any(), any(), any(), any()))
                .thenReturn(new PageResult<>(List.of(helmet), 1, 10, 1, 1));
        ChatToolService tools = new ChatToolService(catalog, mock(OrderReadService.class));
        ChatToolRegistry registry = new ChatToolRegistry();

        ChatToolService.ToolExecution accepted = tools.execute(
                registry.validate(ChatToolRegistry.SEARCH_PRODUCTS, MAPPER.valueToTree(Map.of(
                        "query", "mũ bảo hiểm", "maxPrice", 2_000_000L, "lang", "vi"))),
                new ChatToolService.ToolContext("mbh dưới 2tr", "vi", null, legacySettings()),
                new ChatToolService.ToolSession());
        assertThat(accepted.products()).extracting(card -> card.slug()).containsExactly("mu-safe");

        assertThatThrownBy(() -> tools.execute(
                registry.validate(ChatToolRegistry.SEARCH_PRODUCTS, MAPPER.valueToTree(Map.of(
                        "category", "tai-nghe-bluetooth-mu-bao-hiem", "maxPrice", 2_000_000L, "lang", "vi"))),
                new ChatToolService.ToolContext("mbh dưới 2tr", "vi", null, legacySettings()),
                new ChatToolService.ToolSession()))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("an exact availability question is a stable terminal answer on repeated turns")
    void exactAvailabilityQuestionUsesStableVerifiedTerminalAnswer() {
        CatalogReadService catalog = mock(CatalogReadService.class);
        Product tanami = product(
                "tanami-carbon", "Mũ dual sport Caberg Tanami Carbon", BigDecimal.valueOf(12_000_000), List.of());
        when(catalog.searchProductsForAssistant(any(), any(), any(), any(), any(), any(), anyInt(), any()))
                .thenReturn(List.of(tanami));
        ChatToolService tools = new ChatToolService(catalog, mock(OrderReadService.class));
        ChatToolRegistry.ValidatedCall call = new ChatToolRegistry().validate(
                ChatToolRegistry.SEARCH_PRODUCTS,
                MAPPER.valueToTree(Map.of("query", "Tanami Carbon", "lang", "vi")));

        List<String> answers = new java.util.ArrayList<>();
        for (int attempt = 0; attempt < 3; attempt++) {
            ChatToolService.ToolExecution result = tools.execute(
                    call,
                    new ChatToolService.ToolContext("có mũ Tanami Carbon không", "vi", null, settings()),
                    new ChatToolService.ToolSession());
            assertThat(result.terminalAnswer()).isNotNull();
            assertThat(result.products()).extracting(card -> card.slug()).containsExactly("tanami-carbon");
            answers.add(result.terminalAnswer().answer());
        }

        assertThat(answers).containsOnly(answers.get(0));
        assertThat(answers.get(0)).contains("còn hàng", "Anh/chị");
    }

    @Test
    @DisplayName("a verified nearest price alternative keeps cards instead of a bare no-match answer")
    void priceRangeMissReturnsClosestVerifiedCardsDeterministically() {
        CatalogReadService catalog = mock(CatalogReadService.class);
        Product helmet = product(
                "mu-nearest", "Mũ bảo hiểm nearest", BigDecimal.valueOf(1_590_000), List.of());
        when(catalog.listProducts(anyInt(), anyInt(), any(), any(), any(), any(), any(), any(),
                any(), any(), any(), any()))
                .thenReturn(new PageResult<>(List.of(helmet), 1, 10, 1, 1));
        ChatToolService tools = new ChatToolService(catalog, mock(OrderReadService.class));
        ChatToolRegistry.ValidatedCall call = new ChatToolRegistry().validate(
                ChatToolRegistry.SEARCH_PRODUCTS,
                MAPPER.valueToTree(Map.of("query", "mũ", "lang", "vi")));

        ChatToolService.ToolExecution result = tools.execute(
                call,
                new ChatToolService.ToolContext("mũ dưới 1 triệu", "vi", null, settings()),
                new ChatToolService.ToolSession());

        assertThat(result.terminalAnswer()).isNotNull();
        assertThat(result.terminalAnswer().answer()).contains("tầm giá", "phương án gần nhất");
        assertThat(result.products()).extracting(card -> card.slug()).containsExactly("mu-nearest");
    }

    @Test
    @DisplayName("LS2 wording with or without accents uses the verified brand filter, not a title guess")
    void ls2BrandOnlyRequestReturnsOnlyTheVerifiedBrandFilter() {
        CatalogReadService catalog = mock(CatalogReadService.class);
        Product ls2 = product("ls2-of616", "Mũ bảo hiểm LS2 OF616", BigDecimal.valueOf(1_590_000), List.of());
        when(catalog.listAssistantBrands()).thenReturn(List.of(brand("ls2", "LS2")));
        when(catalog.listProducts(anyInt(), anyInt(), any(), any(), any(), any(), any(), any(),
                any(), any(), any(), any()))
                .thenAnswer(invocation -> "ls2".equals(invocation.getArgument(4))
                        ? new PageResult<>(List.of(ls2), 1, 10, 1, 1)
                        : new PageResult<>(List.of(), 1, 10, 0, 0));
        ChatToolService tools = new ChatToolService(catalog, mock(OrderReadService.class));

        for (String question : List.of(
                "Tìm sản phẩm thương hiệu LS2",
                "sản phẩm LS2",
                "mũ LS2",
                "san pham ls2")) {
            ChatToolService.ToolOutcome outcome = tools.resolve(question, "vi", null, settings());
            assertThat(outcome.products()).as(question).extracting(card -> card.slug())
                    .containsExactly("ls2-of616");
            assertThat(outcome.toolJson()).as(question).contains("\"brand\":\"ls2\"");
        }

        ArgumentCaptor<String> category = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> brand = ArgumentCaptor.forClass(String.class);
        verify(catalog, times(4)).listProducts(anyInt(), anyInt(), any(), category.capture(), brand.capture(),
                any(), any(), any(), any(), any(), any(), any());
        assertThat(brand.getAllValues()).containsOnly("ls2");
        assertThat(category.getAllValues()).containsExactly(null, null, "mu-bao-hiem", null);
    }

    @Test
    @DisplayName("helmet price questions retain the helmet scope and the stated price direction")
    void helmetPriceQuestionsNeverEscapeTheirCategoryOrPriceRange() {
        CatalogReadService catalog = mock(CatalogReadService.class);
        List<Product> helmets = List.of(
                product("mu-under", "Mũ bảo hiểm dưới ngưỡng", BigDecimal.valueOf(1_590_000), List.of()),
                product("mu-around", "Mũ bảo hiểm quanh năm triệu", BigDecimal.valueOf(5_000_000), List.of()),
                product("mu-over", "Mũ bảo hiểm trên ngưỡng", BigDecimal.valueOf(6_500_000), List.of()));
        when(catalog.listProducts(anyInt(), anyInt(), any(), any(), any(), any(), any(), any(),
                any(), any(), any(), any()))
                .thenReturn(new PageResult<>(helmets, 1, 10, helmets.size(), 1));
        ChatToolService tools = new ChatToolService(catalog, mock(OrderReadService.class));

        ChatToolService.ToolOutcome around = tools.resolve(
                "tìm mũ bảo hiểm 5 triệu", "vi", null, settings());
        assertThat(around.products()).extracting(card -> card.slug()).containsExactly("mu-around");

        ChatToolService.ToolOutcome below = tools.resolve(
                "tôi đang tìm mũ dưới 5 triệu", "vi", null, settings());
        assertThat(below.products()).extracting(card -> card.slug()).containsExactly("mu-under");

        ChatToolService.ToolOutcome above = tools.resolve(
                "mũ trên 3 triệu", "vi", null, settings());
        assertThat(above.products()).extracting(card -> card.slug())
                .containsExactly("mu-around", "mu-over");
        assertThat(above.localAnswer()).isNull();
        verify(catalog, atLeastOnce()).listProducts(anyInt(), anyInt(), any(),
                org.mockito.ArgumentMatchers.eq("mu-bao-hiem"), any(), any(), any(), any(),
                any(), any(), any(), any());
    }

    @Test
    @DisplayName("a generic floor request returns three verified cards instead of one")
    void genericFloorRequestReturnsThreeCards() {
        CatalogReadService catalog = mock(CatalogReadService.class);
        List<Product> candidates = List.of(
                product("from-five-1", "Sản phẩm từ năm triệu 1", BigDecimal.valueOf(5_000_000), List.of()),
                product("from-five-2", "Sản phẩm từ năm triệu 2", BigDecimal.valueOf(6_000_000), List.of()),
                product("from-five-3", "Sản phẩm từ năm triệu 3", BigDecimal.valueOf(7_000_000), List.of()),
                product("from-five-4", "Sản phẩm từ năm triệu 4", BigDecimal.valueOf(8_000_000), List.of()));
        when(catalog.listProducts(anyInt(), anyInt(), any(), any(), any(), any(), any(), any(),
                any(), any(), any(), any()))
                .thenReturn(new PageResult<>(candidates, 1, 10, candidates.size(), 1));

        ChatToolService.ToolOutcome outcome = new ChatToolService(catalog, mock(OrderReadService.class))
                .resolve("Tìm 3 sản phẩm từ 5tr", "vi", null, settings());

        assertThat(outcome.products()).hasSize(3);
        assertThat(outcome.products()).allSatisfy(card ->
                assertThat(card.retailPrice()).isGreaterThanOrEqualTo(BigDecimal.valueOf(5_000_000)));
    }

    @Test
    @DisplayName("headset price questions retain the separate headset category")
    void headsetPriceQuestionsKeepTheHeadsetCategoryAndPriceRange() {
        CatalogReadService catalog = mock(CatalogReadService.class);
        List<Product> headsets = List.of(
                product("headset-low", "Tai nghe Bluetooth dưới một triệu", BigDecimal.valueOf(500_000), List.of()),
                product("headset-high", "Tai nghe Bluetooth trên hai triệu", BigDecimal.valueOf(2_500_000), List.of()));
        when(catalog.listProducts(anyInt(), anyInt(), any(), any(), any(), any(), any(), any(),
                any(), any(), any(), any()))
                .thenReturn(new PageResult<>(headsets, 1, 10, headsets.size(), 1));
        ChatToolService tools = new ChatToolService(catalog, mock(OrderReadService.class));

        assertThat(tools.resolve("tai nghe dưới 1 triệu", "vi", null, settings()).products())
                .extracting(card -> card.slug()).containsExactly("headset-low");
        assertThat(tools.resolve("tai nghe trên 2 tr", "vi", null, settings()).products())
                .extracting(card -> card.slug()).containsExactly("headset-high");
        verify(catalog, atLeastOnce()).listProducts(anyInt(), anyInt(), any(),
                org.mockito.ArgumentMatchers.eq("tai-nghe-bluetooth-mu-bao-hiem"), any(), any(), any(), any(),
                any(), any(), any(), any());
    }

    @Test
    @DisplayName("a missing headset price range chooses one verified alternative on each boundary")
    void missingRangeUsesNearestBelowAndAboveInsteadOfCheapestProducts() {
        CatalogReadService catalog = mock(CatalogReadService.class);
        List<Product> candidates = List.of(
                product("accessory", "Bộ phụ kiện tai nghe SCS", BigDecimal.valueOf(580_000), List.of()),
                product("s7x", "SCS S7X", BigDecimal.valueOf(650_000), List.of()),
                product("s10x", "SCS S10X", BigDecimal.valueOf(1_550_000), List.of()),
                product("s13", "SCS S13", BigDecimal.valueOf(3_190_000), List.of()),
                product("t2-plus", "SCS T2 Plus", BigDecimal.valueOf(3_390_000), List.of()));
        when(catalog.listProducts(anyInt(), anyInt(), any(), any(), any(), any(), any(), any(),
                any(), any(), any(), any()))
                .thenReturn(new PageResult<>(candidates, 1, 10, candidates.size(), 1));
        ChatToolService tools = new ChatToolService(catalog, mock(OrderReadService.class));

        ChatToolService.ToolOutcome outcome = tools.resolve(
                "tôi muốn tìm sản phẩm tai nghe từ 2tr đến 3tr", "vi", null, settings());

        assertThat(outcome.products()).extracting(card -> card.slug())
                .containsExactly("s10x", "s13");
        assertThat(outcome.requiredDisclosures())
                .containsExactly(ChatToolService.RequiredDisclosure.PRICE_RANGE_MISS);
    }

    @Test
    @DisplayName("a matching model from this conversation stays among the capped cards and no more than three names are spoken")
    void priorMentionIsPrioritizedWithoutDroppingTheVerifiedSmallSet() {
        CatalogReadService catalog = mock(CatalogReadService.class);
        List<Product> headsets = List.of(
                product("s13", "SCS S13", BigDecimal.valueOf(3_190_000), List.of()),
                product("g7-plus", "SCS G7+", BigDecimal.valueOf(3_290_000), List.of()),
                product("t2-plus", "SCS T2 Plus", BigDecimal.valueOf(3_390_000), List.of()),
                product("scs-s12", "SCS S12", BigDecimal.valueOf(5_890_000), List.of()));
        when(catalog.listProducts(anyInt(), anyInt(), any(), any(), any(), any(), any(), any(),
                any(), any(), any(), any()))
                .thenReturn(new PageResult<>(headsets, 1, 10, headsets.size(), 1));
        ChatToolService tools = new ChatToolService(catalog, mock(OrderReadService.class));
        ChatToolService.ConversationContext context = new ChatToolService.ConversationContext(
                "tai-nghe-bluetooth-mu-bao-hiem", null, null, null, List.of("scs-s12"), false);
        ChatToolRegistry.ValidatedCall call = new ChatToolRegistry().validate(
                ChatToolRegistry.SEARCH_PRODUCTS,
                MAPPER.valueToTree(Map.of("minPrice", 3_000_000, "lang", "vi")));

        ChatToolService.ToolExecution result = tools.execute(
                call,
                new ChatToolService.ToolContext("từ 3 tr", "vi", null, settings(), context),
                new ChatToolService.ToolSession());

        assertThat(result.products()).extracting(card -> card.slug())
                .containsExactly("scs-s12", "s13", "g7-plus");
        assertThat(result.terminalAnswer()).isNotNull();
        assertThat(result.terminalAnswer().answer())
                .contains("SCS S13", "SCS G7+", "SCS S12")
                .doesNotContain("SCS T2 Plus")
                .contains("hiển thị 3 thẻ tiêu biểu trong tổng 4 mẫu");
    }

    @Test
    @DisplayName("a broad category fallback keeps a verified card and labels it as broader")
    void genericNearMatchUsesCardsAndBroadeningDisclosure() {
        CatalogReadService catalog = mock(CatalogReadService.class);
        Product helmet = product(
                "mu-broad", "Mũ bảo hiểm fullface Broad", BigDecimal.valueOf(2_000_000), List.of());
        when(catalog.listProducts(anyInt(), anyInt(), any(), any(), any(), any(), any(), any(),
                any(), any(), any(), any()))
                .thenAnswer(invocation -> new PageResult<>(
                        invocation.getArgument(5) == null ? List.of(helmet) : List.of(),
                        1, 10, 1, 1));
        ChatToolService tools = new ChatToolService(catalog, mock(OrderReadService.class));
        ChatToolRegistry.ValidatedCall call = new ChatToolRegistry().validate(
                ChatToolRegistry.SEARCH_PRODUCTS,
                MAPPER.valueToTree(Map.of("query", "cao cap", "lang", "vi")));

        ChatToolService.ToolExecution result = tools.execute(
                call,
                new ChatToolService.ToolContext("mũ bảo hiểm cao cấp", "vi", null, legacySettings()),
                new ChatToolService.ToolSession());

        assertThat(result.products()).extracting(card -> card.slug()).containsExactly("mu-broad");
        assertThat(result.requiredDisclosures())
                .containsExactly(ChatToolService.RequiredDisclosure.BROADENED_SEARCH);
        assertThat(result.terminalAnswer()).isNotNull();
        assertThat(result.terminalAnswer().answer()).contains("rộng hơn", "Anh/chị");
    }

    @Test
    @DisplayName("CHAT_RULE_017: size and colour constrain gloves without becoming a model search")
    void sizeAndColourStayOptionFiltersNotIdentifiers() {
        CatalogReadService catalog = mock(CatalogReadService.class);
        Product glove = product(
                "gang-tay-den-l", "Găng tay touring đen", BigDecimal.valueOf(850_000),
                List.of(variant(true, "Màu sắc", "Đen", "Size", "L")));
        when(catalog.listProducts(anyInt(), anyInt(), any(), any(), any(), any(), any(), any(),
                any(), any(), any(), any()))
                .thenReturn(new PageResult<>(List.of(glove), 1, 10, 1, 1));
        when(catalog.getProductBySlug("gang-tay-den-l", "vi")).thenReturn(glove);
        ChatToolService tools = new ChatToolService(catalog, mock(OrderReadService.class));

        ChatToolService.ToolOutcome outcome = tools.resolve(
                "găng tay size L màu đen", "vi", null, settings());

        assertThat(ChatToolService.extractProductQuery("găng tay size L màu đen").identifiers()).isEmpty();
        assertThat(outcome.localAnswer()).isNull();
        assertThat(outcome.toolJson()).contains("\"color\":\"den\"", "\"size\":\"l\"");
        assertThat(outcome.products()).extracting(card -> card.slug()).containsExactly("gang-tay-den-l");
        verify(catalog, never()).searchProductsForAssistant(
                any(), any(), any(), any(), any(), any(), anyInt(), any());
        verify(catalog, atLeastOnce()).listProducts(anyInt(), anyInt(), any(),
                org.mockito.ArgumentMatchers.eq("gang-tay-xe-may-moto"), any(), any(),
                org.mockito.ArgumentMatchers.eq("den"), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("CHAT_RULE_005: an explicit price reset clears the carried range")
    void explicitPriceResetClearsTheSavedRange() {
        CatalogReadService catalog = mock(CatalogReadService.class);
        Product headset = product(
                "scs-s10x", "Tai nghe mũ bảo hiểm intercom SCS S10X",
                BigDecimal.valueOf(1_550_000), List.of());
        when(catalog.listAssistantCategories(any())).thenReturn(List.of(
                category("tai-nghe-bluetooth-mu-bao-hiem", "Tai nghe bluetooth mũ bảo hiểm")));
        when(catalog.listProducts(anyInt(), anyInt(), any(), any(), any(), any(), any(), any(),
                any(), any(), any(), any()))
                .thenReturn(new PageResult<>(List.of(headset), 1, 10, 1, 1));
        ChatToolService tools = new ChatToolService(catalog, mock(OrderReadService.class));
        ChatToolService.ConversationContext prior = new ChatToolService.ConversationContext(
                "mu-bao-hiem", null, 1_000_000L, 2_000_000L, List.of(), false);

        ChatToolService.ToolOutcome outcome = tools.resolve(
                "tai nghe, bỏ giới hạn giá xem hết đi", "vi", null, settings(), prior);
        ChatToolService.ConversationContext updated = tools.recordConversationContext(
                prior,
                "tai nghe, bỏ giới hạn giá xem hết đi",
                "vi",
                outcome.products(),
                outcome.actions());

        assertThat(outcome.toolJson()).contains("\"inheritedPrice\":false", "\"min_price\":\"\"");
        assertThat(updated.minPrice()).isNull();
        assertThat(updated.maxPrice()).isNull();
    }

    @Test
    @DisplayName("CHAT_RULE_005: a newly stated price wins even beside reset wording")
    void currentPriceOverridesResetWordingAndIsSavedForTheNextTurn() {
        CatalogReadService catalog = mock(CatalogReadService.class);
        Product headset = product(
                "scs-s10x", "Tai nghe mũ bảo hiểm intercom SCS S10X",
                BigDecimal.valueOf(1_550_000), List.of());
        when(catalog.listAssistantCategories(any())).thenReturn(List.of(
                category("tai-nghe-bluetooth-mu-bao-hiem", "Tai nghe bluetooth mũ bảo hiểm")));
        when(catalog.listProducts(anyInt(), anyInt(), any(), any(), any(), any(), any(), any(),
                any(), any(), any(), any()))
                .thenReturn(new PageResult<>(List.of(headset), 1, 10, 1, 1));
        ChatToolService tools = new ChatToolService(catalog, mock(OrderReadService.class));
        ChatToolService.ConversationContext prior = new ChatToolService.ConversationContext(
                "mu-bao-hiem", null, 1_000_000L, 2_000_000L, List.of(), false);
        String question = "tai nghe, bỏ giới hạn giá nhưng tầm 2 triệu";

        ChatToolService.ToolOutcome outcome = tools.resolve(question, "vi", null, settings(), prior);
        ChatToolService.ConversationContext updated = tools.recordConversationContext(
                prior, question, "vi", outcome.products(), outcome.actions());

        assertThat(outcome.toolJson()).contains(
                "\"inheritedPrice\":false", "\"min_price\":1400000", "\"max_price\":2400000");
        assertThat(updated.minPrice()).isEqualTo(1_400_000L);
        assertThat(updated.maxPrice()).isEqualTo(2_400_000L);
    }

    @Test
    @DisplayName("CHAT_RULE_020: a verified headset search exposes only its two current counts")
    void verifiedHeadsetSearchCarriesScopeAndPriceRangeCounts() {
        CatalogReadService catalog = mock(CatalogReadService.class);
        Product headset = product(
                "scs-s10x", "Tai nghe mũ bảo hiểm intercom SCS S10X",
                BigDecimal.valueOf(1_550_000), List.of());
        Product camera = product(
                "scs-cam", "Camera hành trình gắn mũ bảo hiểm SCS Cam-S",
                BigDecimal.valueOf(1_550_000), List.of());
        when(catalog.listAssistantCategories(any())).thenReturn(List.of(
                category("tai-nghe-bluetooth-mu-bao-hiem", "Tai nghe bluetooth mũ bảo hiểm")));
        when(catalog.listProducts(anyInt(), anyInt(), any(), any(), any(), any(), any(), any(),
                any(), any(), any(), any()))
                .thenAnswer(invocation -> {
                    String query = invocation.getArgument(5);
                    Long minPrice = invocation.getArgument(8);
                    Long maxPrice = invocation.getArgument(9);
                    if (!"tai nghe".equals(query)) {
                        return new PageResult<>(List.of(camera), 1, 10, 9, 1);
                    }
                    if (minPrice != null || maxPrice != null) {
                        return new PageResult<>(List.of(headset), 1, 10, 1, 1);
                    }
                    return new PageResult<>(List.of(headset), 1, 10, 8, 1);
                });
        ChatToolService tools = new ChatToolService(catalog, mock(OrderReadService.class));
        ChatToolRegistry.ValidatedCall call = new ChatToolRegistry().validate(
                ChatToolRegistry.SEARCH_PRODUCTS,
                MAPPER.valueToTree(Map.of(
                        "query", "tai nghe",
                        "minPrice", 1_000_000L,
                        "maxPrice", 2_000_000L,
                        "lang", "vi")));

        ChatToolService.ToolExecution result = tools.execute(
                call,
                new ChatToolService.ToolContext(
                        "tai nghe từ 1tr đến 2tr", "vi", null, legacySettings()),
                new ChatToolService.ToolSession());

        assertThat(result.products()).extracting(card -> card.slug()).containsExactly("scs-s10x");
        assertThat(result.catalogTotals())
                .returns(8L, ChatToolService.CatalogTotals::scopeTotalItems)
                .returns(1L, ChatToolService.CatalogTotals::priceRangeTotalItems);
        assertThat(result.responseJson()).contains(
                "\"totalItems\":1", "\"scopeTotalItems\":8", "\"priceRangeTotalItems\":1")
                .doesNotContain("scs-cam");
    }

    @Test
    @DisplayName("CHAT_RULE_018: an unknown model gets only a disclosed alternative in its verified scope")
    void unknownModelGetsDisclosedScopedAlternative() {
        CatalogReadService catalog = mock(CatalogReadService.class);
        Product helmet = product(
                "mu-safe", "Mũ bảo hiểm Safe", BigDecimal.valueOf(1_500_000), List.of());
        when(catalog.searchProductsForAssistant(any(), any(), any(), any(), any(), any(), anyInt(), any()))
                .thenReturn(List.of());
        when(catalog.listProducts(anyInt(), anyInt(), any(), any(), any(), any(), any(), any(),
                any(), any(), any(), any()))
                .thenReturn(new PageResult<>(List.of(helmet), 1, 10, 1, 1));
        ChatToolService tools = new ChatToolService(catalog, mock(OrderReadService.class));
        ChatToolRegistry.ValidatedCall call = new ChatToolRegistry().validate(
                ChatToolRegistry.SEARCH_PRODUCTS,
                MAPPER.valueToTree(Map.of("query", "xqz-no-such-model", "lang", "vi")));

        ChatToolService.ToolExecution result = tools.execute(
                call,
                new ChatToolService.ToolContext(
                        "tôi muốn tìm mũ xqz-no-such-model", "vi", null, legacySettings()),
                new ChatToolService.ToolSession());

        assertThat(result.products()).extracting(card -> card.slug()).containsExactly("mu-safe");
        assertThat(result.requiredDisclosures())
                .containsExactly(ChatToolService.RequiredDisclosure.BROADENED_SEARCH);
        assertThat(result.terminalAnswer()).isNotNull();
        assertThat(result.terminalAnswer().answer()).contains("rộng hơn yêu cầu", "Anh/chị");
    }

    @Test
    @DisplayName("a signed-in acknowledgement stays in the pending order flow")
    void loginAcknowledgementUsesMinimalPendingOrderContext() {
        CatalogReadService catalog = mock(CatalogReadService.class);
        OrderReadService orders = mock(OrderReadService.class);
        ChatToolService tools = new ChatToolService(catalog, orders);
        ChatToolService.ToolOutcome guestOrder = tools.resolve(
                "đơn hàng của tôi", "vi", null, settings());
        ChatToolService.ConversationContext context = tools.recordConversationContext(
                ChatToolService.ConversationContext.empty(),
                "đơn hàng của tôi",
                "vi",
                guestOrder.products(),
                guestOrder.actions());
        UUID customerId = UUID.randomUUID();
        when(orders.listCustomerOrderSummaries(customerId, 1)).thenReturn(List.of(
                new OrderReadService.CustomerOrderSummary(
                        "BB-LOGIN-01", "PROCESSING", Instant.parse("2026-08-11T02:00:00Z"),
                        Instant.parse("2026-08-11T02:00:00Z"), BigDecimal.valueOf(2_500_000), "VND")));

        ChatToolService.ToolOutcome outcome = tools.resolveFastPath(
                "tôi đăng nhập rồi", "vi", customerId, settings(), context).orElseThrow();

        assertThat(context.awaitingOrderLogin()).isTrue();
        assertThat(outcome.localAnswer()).contains("BB-LOGIN-01").doesNotContain("sản phẩm đang bán");
        verify(orders).listCustomerOrderSummaries(customerId, 1);
    }

    @Test
    @DisplayName("get_product keeps only exact in-stock size and color combinations")
    void availableVariantCombinationsStayCoupled() {
        ProductVariant available = variant(true, "Màu sắc", "Đen", "SIZE", "M");
        ProductVariant unavailable = variant(false, "color", "Đỏ", "size", "L");

        assertThat(ChatToolService.normalizedAvailableVariants(List.of(available, unavailable)))
                .containsExactly(Map.of("color", "Đen", "size", "M"));
    }

    @Test
    @DisplayName("search_products forwards only the fixed filters")
    void productSearchUsesFixedAllowlistedArguments() {
        CatalogReadService catalog = mock(CatalogReadService.class);
        OrderReadService orders = mock(OrderReadService.class);
        when(catalog.listProducts(
                1, 10, "price:asc", "mu-bao-hiem", "ls2", "3/4", "Đen", "UNISEX",
                1_000_000L, 2_500_000L, null, "vi"))
                .thenReturn(new PageResult<>(List.of(), 1, 10, 0, 0));
        ChatToolService tools = new ChatToolService(catalog, orders);

        tools.searchProducts(
                "3/4", "mu-bao-hiem", "ls2", 1_000_000L, 2_500_000L,
                "Đen", "UNISEX", "price:asc", "vi");

        verify(catalog).listProducts(
                1, 10, "price:asc", "mu-bao-hiem", "ls2", "3/4", "Đen", "UNISEX",
                1_000_000L, 2_500_000L, null, "vi");
        verifyNoInteractions(orders);
    }

    @Test
    @DisplayName("CHAT_RULE_015: 'từ/trên/trở lên' is a floor, never a ceiling")
    void floorWordingProducesMinPrice() {
        for (String question : List.of(
                "tim san pham tu 5 trieu",
                "co mu nao tren 5 trieu khong",
                "ao giap 5 trieu tro len",
                "gang tay gia it nhat 5 trieu",
                "helmet from 5 trieu")) {
            ChatToolService.PriceIntent intent = ChatToolService.extractPriceIntent(question);
            assertThat(intent.kind()).as(question).isEqualTo(ChatToolService.PriceKind.MIN);
            assertThat(intent.min()).as(question).isEqualTo(5_000_000L);
            assertThat(intent.max()).as(question).isNull();
        }
    }

    @Test
    @DisplayName("CHAT_RULE_015: 'dưới/không quá/đổ lại' stays a ceiling")
    void ceilingWordingProducesMaxPrice() {
        for (String question : List.of(
                "mu fullface duoi 3 trieu",
                "ao giap khong qua 3 trieu",
                "gang tay 3 trieu do lai",
                "khong hon 3 trieu")) {
            ChatToolService.PriceIntent intent = ChatToolService.extractPriceIntent(question);
            assertThat(intent.kind()).as(question).isEqualTo(ChatToolService.PriceKind.MAX);
            assertThat(intent.max()).as(question).isEqualTo(3_000_000L);
            assertThat(intent.min()).as(question).isNull();
        }
    }

    @Test
    @DisplayName("CHAT_RULE_015: a range keeps both ends, including a borrowed unit")
    void rangeWordingKeepsBothEnds() {
        for (String question : List.of(
                "mu bao hiem tu 3 den 5 trieu",
                "mu bao hiem 3 - 5 trieu",
                "mu bao hiem tu 3 trieu den 5 trieu")) {
            ChatToolService.PriceIntent intent = ChatToolService.extractPriceIntent(question);
            assertThat(intent.kind()).as(question).isEqualTo(ChatToolService.PriceKind.RANGE);
            assertThat(intent.min()).as(question).isEqualTo(3_000_000L);
            assertThat(intent.max()).as(question).isEqualTo(5_000_000L);
        }
    }

    @Test
    @DisplayName("CHAT_RULE_015: 'khoảng/tầm' and a bare amount become a band, not a ceiling")
    void approximateWordingProducesBand() {
        for (String question : List.of(
                "mu 3/4 tam 2 trieu", "ao giap khoang 2 trieu", "mu 2 trieu",
                "helmet around 2 million")) {
            ChatToolService.PriceIntent intent = ChatToolService.extractPriceIntent(question);
            assertThat(intent.kind()).as(question).isEqualTo(ChatToolService.PriceKind.BAND);
            assertThat(intent.min()).as(question).isEqualTo(1_400_000L);
            assertThat(intent.max()).as(question).isEqualTo(2_400_000L);
        }
    }

    @Test
    @DisplayName("CHAT_RULE_015: thousands, rưỡi and plain đồng amounts all parse")
    void otherAmountShapesParse() {
        assertThat(ChatToolService.extractPriceIntent("gang tay duoi 500k").max()).isEqualTo(500_000L);
        assertThat(ChatToolService.extractPriceIntent("gang tay duoi 500 nghin").max()).isEqualTo(500_000L);
        assertThat(ChatToolService.extractPriceIntent("mu duoi 2 trieu ruoi").max()).isEqualTo(2_500_000L);
        assertThat(ChatToolService.extractPriceIntent("mu duoi 2.500.000d").max()).isEqualTo(2_500_000L);
    }

    @Test
    @DisplayName("CHAT_RULE_015: English under, above, from-to and between keep their stated ranges")
    void englishPriceWordingKeepsItsMeaning() {
        assertThat(ChatToolService.extractPriceIntent("headsets under 3 million"))
                .returns(ChatToolService.PriceKind.MAX, ChatToolService.PriceIntent::kind)
                .returns(3_000_000L, ChatToolService.PriceIntent::max);
        assertThat(ChatToolService.extractPriceIntent("headsets above 3 million"))
                .returns(ChatToolService.PriceKind.MIN, ChatToolService.PriceIntent::kind)
                .returns(3_000_000L, ChatToolService.PriceIntent::min);
        for (String question : List.of(
                "headsets from 3 to 5 million",
                "headsets between 3 and 5 million")) {
            assertThat(ChatToolService.extractPriceIntent(question))
                    .as(question)
                    .returns(ChatToolService.PriceKind.RANGE, ChatToolService.PriceIntent::kind)
                    .returns(3_000_000L, ChatToolService.PriceIntent::min)
                    .returns(5_000_000L, ChatToolService.PriceIntent::max);
        }
    }

    @Test
    @DisplayName("A product code without a price unit is never read as money")
    void productCodesAreNotPrices() {
        for (String question : List.of("mu ls2 of616", "giay taichi rss 014", "ao giap rsj354")) {
            assertThat(ChatToolService.extractPriceIntent(question).kind())
                    .as(question).isEqualTo(ChatToolService.PriceKind.NONE);
        }
    }

    private static ProductVariant variant(
            boolean available,
            String colorName,
            String colorValue,
            String sizeName,
            String sizeValue
    ) {
        return new ProductVariant(
                "variant", "SKU", "Variant",
                List.of(
                        new ProductVariantOption(colorName, colorValue),
                        new ProductVariantOption(sizeName, sizeValue)),
                null,
                available ? ProductStockState.IN_STOCK : ProductStockState.OUT_OF_STOCK,
                null,
                List.of(),
                available);
    }

    private static Brand brand(String slug, String name) {
        return new Brand(slug, slug, name, null, null, null, null, null,
                true, false, null, null, null);
    }

    private static Category category(String slug, String name) {
        return new Category(slug, slug, null, name, null, null, null, null, null,
                null, null, null, true, false, null, null, null, null, null, null);
    }

    private static ProductVariant sizeVariant(String size) {
        return new ProductVariant(
                "variant-" + size,
                "SKU-" + size,
                size,
                List.of(new ProductVariantOption("Size", size)),
                null,
                ProductStockState.IN_STOCK,
                null,
                List.of(),
                true);
    }

    private static Product product(
            String slug,
            String name,
            BigDecimal retailPrice,
            List<ProductVariant> variants
    ) {
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
                variants,
                ProductStockState.IN_STOCK,
                Boolean.TRUE,
                PublishStatus.PUBLISHED,
                com.bigbike.bigbike_backend.domain.catalog.HomepageBlock.NONE,
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

    private static Product productWithDetails(
            Product base,
            String description,
            String specifications,
            SizeGuideSection sizeGuideSection,
            List<ProductVariant> variants
    ) {
        return new Product(
                base.id(), base.sku(), base.slug(), base.slugEn(), base.name(), base.shortDescription(),
                description, base.brand(), base.category(), base.categories(), base.image(), base.gallery(),
                base.videos(), base.price(), variants, base.stockState(), base.available(), base.publishStatus(),
                base.homepageBlock(), base.homepageOrder(), base.rating(), base.ratingCount(), base.faqs(),
                base.commitments(), base.highlights(), base.originBrandCountry(), base.sizeGuide(),
                base.suitabilityAdvisory(), specifications, base.specStats(), base.trustBadges(),
                base.quickAnswerSummary(), base.gender(), base.relatedProducts(), base.accessoryProducts(),
                base.descriptionBlocks(), base.suitabilitySection(), sizeGuideSection, base.seo(),
                base.translations(), base.createdAt(), base.updatedAt());
    }

    private static ChatAssistantSettings.Snapshot settings() {
        return new ChatAssistantSettings.Snapshot(
                true,
                60,
                "Xin chào",
                List.of("A", "B", "C"),
                new ChatContactResponse("0900", "", "", "", ""),
                "", "", "");
    }

    private static ChatAssistantSettings.Snapshot legacySettings() {
        return new ChatAssistantSettings.Snapshot(
                true,
                60,
                false,
                "Xin chào",
                List.of("A", "B", "C"),
                new ChatContactResponse("0900", "", "", "", ""),
                "", "", "");
    }
}
