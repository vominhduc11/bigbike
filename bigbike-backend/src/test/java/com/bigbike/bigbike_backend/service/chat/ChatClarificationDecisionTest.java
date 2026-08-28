package com.bigbike.bigbike_backend.service.chat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.api.chat.dto.ChatContactResponse;
import com.bigbike.bigbike_backend.api.chat.dto.ChatProductCardResponse;
import com.bigbike.bigbike_backend.domain.catalog.Category;
import com.bigbike.bigbike_backend.domain.catalog.CategorySummary;
import com.bigbike.bigbike_backend.domain.catalog.HomepageBlock;
import com.bigbike.bigbike_backend.domain.catalog.Product;
import com.bigbike.bigbike_backend.domain.catalog.ProductHighlights;
import com.bigbike.bigbike_backend.domain.catalog.ProductPrice;
import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.service.catalog.CatalogReadService;
import com.bigbike.bigbike_backend.service.order.OrderReadService;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class ChatClarificationDecisionTest {

    private CatalogReadService catalog;
    private ChatToolService tools;
    private List<Product> products;

    @BeforeEach
    void setUp() {
        catalog = mock(CatalogReadService.class);
        tools = new ChatToolService(catalog, mock(OrderReadService.class));
        products = catalogProducts();
        List<Category> categories = categories();
        when(catalog.listAssistantCategories("vi")).thenReturn(categories);
        when(catalog.listAssistantCategories("en")).thenReturn(categories);
        when(catalog.listAssistantDecisionProducts("vi")).thenReturn(products);
        when(catalog.listAssistantDecisionProducts("en")).thenReturn(products);
        when(catalog.assistantCompletedSales(anyList()))
                .thenReturn(new CatalogReadService.AssistantSalesSnapshot(0, List.of()));
    }

    @Test
    @DisplayName("price-only request asks a dynamic merged group question without cards")
    void priceOnlyAsksGroupWithoutProducts() {
        ChatToolService.ToolOutcome outcome = turn(
                "tôi muốn tìm sản phẩm giá dưới 5 triệu", "vi",
                ChatToolService.ConversationContext.empty());

        assertThat(outcome.aiRequired()).isFalse();
        assertThat(outcome.clarification()).isNotNull();
        assertThat(outcome.clarification().criterion()).isEqualTo("GROUP");
        assertThat(outcome.products()).isEmpty();
        assertThat(outcome.localAnswer())
                .contains("Mũ bảo hiểm: 13 lựa chọn")
                .contains("Balo – Túi đeo – Túi treo xe: 10 lựa chọn")
                .contains("Anh/chị đang cần nhóm nào");
        assertThat(outcome.clarification().options())
                .anySatisfy(option -> {
                    assertThat(option.label()).isEqualTo("Mũ bảo hiểm");
                    assertThat(option.count()).isEqualTo(13);
                })
                .anySatisfy(option -> assertThat(option.kind()).isEqualTo("BYPASS"));
        assertThat(new ChatResponseGuard().check(
                outcome.localAnswer(), outcome.products(), "vi")).isPresent();
    }

    @Test
    @DisplayName("three local turns narrow group then use case and stop at eight or fewer")
    void multiRoundNarrowingNeverRepeatsAndStops() {
        ChatToolService.ConversationContext context = ChatToolService.ConversationContext.empty();
        ChatToolService.ToolOutcome first = turn(
                "tôi muốn tìm sản phẩm giá dưới 5 triệu", "vi", context);
        context = remember(context, "tôi muốn tìm sản phẩm giá dưới 5 triệu", "vi", first);

        ChatToolService.ToolOutcome second = turn("mũ bảo hiểm", "vi", context);
        assertThat(second.clarification()).isNotNull();
        assertThat(second.clarification().criterion()).isEqualTo("USE_CASE");
        assertThat(second.products()).hasSizeBetween(2, 3);
        assertThat(second.localAnswer()).contains("chưa phải kết quả cuối");
        assertThat(second.clarification().options())
                .extracting(option -> option.label())
                .contains("Đi tour đường dài", "Cứ cho em xem tất cả");
        assertThat(new ChatResponseGuard().check(
                second.localAnswer(), second.products(), "vi")).isPresent();
        context = remember(context, "mũ bảo hiểm", "vi", second);

        ChatToolService.ToolOutcome third = turn("đi tour đường dài", "vi", context);
        assertThat(third.clarification()).isNull();
        assertThat(third.products()).hasSize(5);
        assertThat(third.localAnswer()).contains("không hỏi thêm");
        assertThat(third.nextProductDecision().askedCriteria())
                .containsExactlyInAnyOrder("GROUP", "USE_CASE");
    }

    @Test
    @DisplayName("a specific helmet type and budget is answered immediately")
    void clearFullfaceRequestDoesNotAsk() {
        ChatToolService.ToolOutcome outcome = turn(
                "mũ fullface dưới 5 triệu", "vi",
                ChatToolService.ConversationContext.empty());

        assertThat(outcome.clarification()).isNull();
        assertThat(outcome.products()).hasSize(4);
        assertThat(outcome.localAnswer()).contains("đủ thông tin");
    }

    @Test
    @DisplayName("an explicit missing-budget request asks for price before another preference")
    void knownGroupBudgetFramingAsksPrice() {
        ChatToolService.ToolOutcome outcome = turn(
                "tìm mũ bảo hiểm theo ngân sách", "vi",
                ChatToolService.ConversationContext.empty());

        assertThat(outcome.clarification()).isNotNull();
        assertThat(outcome.clarification().criterion()).isEqualTo("PRICE");
        assertThat(outcome.clarification().options())
                .extracting(option -> option.label())
                .contains("Dưới 2 triệu", "Từ 2 đến 5 triệu", "Cứ cho em xem tất cả");
    }

    @Test
    @DisplayName("policy is immediate while general advice and personal size are clarified")
    void policyAndGenericQuestionsTakeCorrectBranches() {
        assertThat(tools.resolveFastPath(
                "chính sách đổi trả thế nào", "vi", null, settings()).orElseThrow()
                .clarification()).isNull();

        ChatToolService.ToolOutcome advice = turn(
                "tư vấn giúp tôi với", "vi", ChatToolService.ConversationContext.empty());
        assertThat(advice.clarification()).isNotNull();
        assertThat(advice.clarification().criterion()).isEqualTo("GROUP");
        assertThat(advice.products()).isEmpty();

        ChatToolService.ToolOutcome equivalentAdvice = turn(
                "tôi muốn được tư vấn", "vi", ChatToolService.ConversationContext.empty());
        assertThat(equivalentAdvice.clarification()).isNotNull();
        assertThat(equivalentAdvice.clarification().criterion()).isEqualTo("GROUP");

        ChatToolService.ToolOutcome size = turn(
                "size nào vừa với tôi", "vi", ChatToolService.ConversationContext.empty());
        assertThat(size.clarification()).isNotNull();
        assertThat(size.localAnswer()).contains("số đo");
    }

    @Test
    @DisplayName("an unrelated immediate intent interrupts a pending clarification without losing professionalism")
    void immediateIntentStopsPendingClarification() {
        ChatToolService.ConversationContext pending = pendingHelmetContext();

        ChatToolService.ToolOutcome thanks = turn("cảm ơn em", "vi", pending);
        assertThat(thanks.clarification()).isNull();
        assertThat(thanks.products()).isEmpty();
        assertThat(thanks.localAnswer()).contains("rất vui được hỗ trợ");

        ChatToolService.ToolOutcome staff = turn("tôi muốn gặp nhân viên", "vi", pending);
        assertThat(staff.clarification()).isNull();
        assertThat(staff.handoffRecommended()).isTrue();

        ChatToolService.ToolOutcome policy = turn("chính sách đổi trả thế nào", "vi", pending);
        assertThat(policy.clarification()).isNull();
        assertThat(policy.products()).isEmpty();
    }

    @Test
    @DisplayName("a later budget keeps the helmet group already stated and never asks it again")
    void laterBudgetKeepsKnownGroup() {
        ChatToolService.ConversationContext context = pendingHelmetContext();

        ChatToolService.ToolOutcome outcome = turn("dưới 5 triệu", "vi", context);

        assertThat(outcome.nextProductDecision().group()).isEqualTo("helmet");
        if (outcome.clarification() != null) {
            assertThat(outcome.clarification().criterion()).isNotEqualTo("GROUP");
        }
        assertThat(outcome.nextProductDecision().askedCriteria()).contains("USE_CASE");
    }

    @Test
    @DisplayName("a verified category from an older turn is still remembered as the product group")
    void inheritedCategoryDoesNotAskGroupAgain() {
        ChatToolService.ConversationContext context = new ChatToolService.ConversationContext(
                "mu-bao-hiem", null, null, null, List.of(), false);

        ChatToolService.ToolOutcome outcome = turn("dưới 5 triệu", "vi", context);

        assertThat(outcome.nextProductDecision().group()).isEqualTo("helmet");
        if (outcome.clarification() != null) {
            assertThat(outcome.clarification().criterion()).isNotEqualTo("GROUP");
        }
    }

    @Test
    @DisplayName("show-all and delegated-choice requests stop asking")
    void explicitStopsDoNotAskAgain() {
        ChatToolService.ConversationContext pending = pendingHelmetContext();

        ChatToolService.ToolOutcome show = turn("cứ cho xem hết đi", "vi", pending);
        assertThat(show.clarification()).isNull();
        assertThat(show.products()).hasSize(8);

        ChatToolService.ToolOutcome delegated = turn("tùy em", "vi", pending);
        assertThat(delegated.clarification()).isNull();
        assertThat(delegated.products()).hasSize(1);
        assertThat(delegated.localAnswer())
                .contains("chưa đủ để xếp hạng")
                .contains("đánh dấu nổi bật");
    }

    @Test
    @DisplayName("delegated fallback never chooses an out-of-stock featured item")
    void delegatedFallbackSkipsOutOfStockFeaturedProduct() {
        Product unavailableFeatured = product(
                "featured-out", "Mũ nổi bật hết hàng", "touring đường dài",
                "mu-bao-hiem-fullface", 2_000_000L, false, HomepageBlock.FEATURED_GRID, 0);
        ArrayList<Product> changed = new ArrayList<>(products);
        changed.add(0, unavailableFeatured);
        when(catalog.listAssistantDecisionProducts("vi")).thenReturn(changed);

        ChatToolService.ToolOutcome outcome = turn("tùy em", "vi", pendingHelmetContext());

        assertThat(outcome.products()).singleElement()
                .extracting(card -> card.slug())
                .isEqualTo("helmet-0");
        assertThat(outcome.products()).noneMatch(card -> card.slug().equals("featured-out"));
    }

    @Test
    @DisplayName("English customers receive an English clarification and choices")
    void englishClarificationIsFullyEnglish() {
        ChatToolService.ToolOutcome outcome = turn(
                "show me products under 5 million", "en",
                ChatToolService.ConversationContext.empty());

        assertThat(outcome.clarification()).isNotNull();
        assertThat(outcome.localAnswer())
                .contains("Which product group do you need?")
                .doesNotContain("anh/chị", "lựa chọn");
        assertThat(outcome.clarification().options())
                .extracting(option -> option.label())
                .contains("Helmets", "Show all matching items");
        assertThat(new ChatResponseGuard().check(
                outcome.localAnswer(), outcome.products(), "en")).isPresent();

        ChatToolService.ConversationContext context = remember(
                ChatToolService.ConversationContext.empty(),
                "show me products under 5 million", "en", outcome);
        ChatToolService.ToolOutcome knownGroup = turn("helmets", "en", context);
        assertThat(knownGroup.clarification()).isNotNull();
        assertThat(knownGroup.clarification().criterion()).isEqualTo("USE_CASE");
        assertThat(new ChatResponseGuard().check(
                knownGroup.localAnswer(), knownGroup.products(), "en")).isPresent();

        ChatToolService.ToolOutcome advice = turn(
                "I need advice", "en", ChatToolService.ConversationContext.empty());
        assertThat(advice.clarification()).isNotNull();
        assertThat(advice.localAnswer()).contains("Which product group do you need?");
    }

    @Test
    @DisplayName("every use-case and remaining-criterion question passes the internal response guard")
    void allClarificationQuestionCopyPassesGuard() {
        ChatResponseGuard guard = new ChatResponseGuard();
        List<ChatProductCardResponse> safeCards = List.of(
                new ChatProductCardResponse(
                        "sample-1", "Sample one", null, BigDecimal.valueOf(1_000_000),
                        null, "VND", "IN_STOCK"),
                new ChatProductCardResponse(
                        "sample-2", "Sample two", null, BigDecimal.valueOf(2_000_000),
                        null, "VND", "IN_STOCK"));
        List<String> groups = List.of(
                "helmet", "apparel", "gloves", "boots", "bags",
                "headset", "armor", "rain_base", "mount_camera");

        for (boolean english : List.of(false, true)) {
            String lang = english ? "en" : "vi";
            List<String> questions = new ArrayList<>();
            for (String group : groups) {
                questions.add(ChatToolService.useCaseQuestion(group, english));
            }
            questions.addAll(english
                    ? List.of(
                            "Which product type would you like to narrow this to?",
                            "Which price range would you like me to use?",
                            "Which available size should I filter by?",
                            "Which available color would you prefer?")
                    : List.of(
                            "Anh/chị muốn thu hẹp theo kiểu sản phẩm nào ạ?",
                            "Anh/chị muốn em lọc tiếp theo tầm giá nào ạ?",
                            "Anh/chị cần lọc theo size nào ạ?",
                            "Anh/chị thích màu nào trong các màu đang có ạ?"));
            for (String group : groups) {
                String measurement = ChatToolService.measurementForGroup(group, english);
                questions.add(english
                        ? "I should not guess a size from height or weight alone. What is your "
                                + measurement
                                + " in centimetres? You can type the number, choose measurement help, or show the available sizes."
                        : "Em không đoán size chỉ từ chiều cao hoặc cân nặng. "
                                + measurement
                                + " của anh/chị là bao nhiêu cm ạ? Anh/chị có thể nhập số đo, xem hướng dẫn cách đo hoặc chọn xem các size đang có.");
            }

            for (String question : questions) {
                String answer = english
                        ? "In this product group, the criteria known so far leave 9 current choices. I’m showing a few representative items that are in stock below; these are not the final results yet. "
                                + question
                        : "Trong nhóm hàng này, các tiêu chí đã biết còn 9 lựa chọn đang bán. Em gửi vài món còn hàng tiêu biểu bên dưới; đây chưa phải kết quả cuối. "
                                + question;
                assertThat(guard.check(answer, safeCards, lang))
                        .as(guard.rejectionReason(
                                answer, safeCards, lang, List.of(), java.util.Set.of()))
                        .describedAs(guard.rejectionReason(
                                answer, safeCards, lang, List.of(), java.util.Set.of())
                                + " | " + question)
                        .isPresent();
            }
        }
    }

    @Test
    @DisplayName("completed-order ranking starts only at the approved evidence threshold")
    void completedOrderRankingUsesUnitsThenCompletedOrders() {
        when(catalog.assistantCompletedSales(anyList())).thenReturn(
                new CatalogReadService.AssistantSalesSnapshot(10, List.of(
                        new CatalogReadService.AssistantProductSale("product-helmet-1", 12, 7),
                        new CatalogReadService.AssistantProductSale("product-helmet-2", 12, 8))));

        ChatToolService.ToolOutcome outcome = turn("tùy em", "vi", pendingHelmetContext());

        assertThat(outcome.products()).singleElement()
                .extracting(card -> card.slug())
                .isEqualTo("helmet-2");
        assertThat(outcome.localAnswer()).contains("bán nhiều nhất", "đơn đã hoàn tất");
    }

    @Test
    @DisplayName("best-seller ranking stays off below ten orders or when sales cover only one product")
    void completedOrderRankingRequiresBothEvidenceThresholds() {
        when(catalog.assistantCompletedSales(anyList())).thenReturn(
                new CatalogReadService.AssistantSalesSnapshot(9, List.of(
                        new CatalogReadService.AssistantProductSale("product-helmet-2", 99, 9),
                        new CatalogReadService.AssistantProductSale("product-helmet-3", 20, 3))));

        ChatToolService.ToolOutcome belowOrderThreshold = turn(
                "tùy em", "vi", pendingHelmetContext());
        assertThat(belowOrderThreshold.products()).singleElement()
                .extracting(card -> card.slug())
                .isEqualTo("helmet-0");
        assertThat(belowOrderThreshold.localAnswer()).contains("chưa đủ để xếp hạng");

        when(catalog.assistantCompletedSales(anyList())).thenReturn(
                new CatalogReadService.AssistantSalesSnapshot(10, List.of(
                        new CatalogReadService.AssistantProductSale("product-helmet-2", 99, 10))));

        ChatToolService.ToolOutcome oneProductOnly = turn(
                "tùy em", "vi", pendingHelmetContext());
        assertThat(oneProductOnly.products()).singleElement()
                .extracting(card -> card.slug())
                .isEqualTo("helmet-0");
        assertThat(oneProductOnly.localAnswer()).contains("chưa đủ để xếp hạng");
    }

    private ChatToolService.ToolOutcome turn(
            String question,
            String lang,
            ChatToolService.ConversationContext context
    ) {
        return tools.resolveFastPath(question, lang, null, settings(), context).orElseThrow();
    }

    private ChatToolService.ConversationContext remember(
            ChatToolService.ConversationContext context,
            String question,
            String lang,
            ChatToolService.ToolOutcome outcome
    ) {
        return tools.recordConversationContext(
                context, question, lang, outcome.products(), List.of(),
                outcome.effectiveSearchScope(), outcome.nextProductDecision());
    }

    private ChatToolService.ConversationContext pendingHelmetContext() {
        ChatToolService.ToolOutcome first = turn(
                "mũ bảo hiểm", "vi", ChatToolService.ConversationContext.empty());
        return remember(ChatToolService.ConversationContext.empty(), "mũ bảo hiểm", "vi", first);
    }

    private static ChatAssistantSettings.Snapshot settings() {
        return new ChatAssistantSettings.Snapshot(
                true, 60, "Xin chào", List.of("A", "B", "C"),
                new ChatContactResponse("0900", "", "", "", ""), "", "", "");
    }

    private static List<Category> categories() {
        return List.of(
                category("helmet-root", "mu-bao-hiem", "Mũ bảo hiểm", null, 1),
                category("helmet-fullface", "mu-bao-hiem-fullface", "Mũ fullface", "helmet-root", 2),
                category("helmet-dual", "mu-bao-hiem-dual-sport", "Mũ dual sport", "helmet-root", 3),
                category("helmet-three-quarter", "mu-bao-hiem-3-4", "Mũ 3/4 và nửa đầu", null, 4),
                category("bags-root", "balo-tui-deo-tui-treo-xe", "Balo và túi", null, 5),
                category("apparel-root", "ao-quan-bao-ho", "Áo quần mô tô", null, 6));
    }

    private static Category category(
            String id,
            String slug,
            String name,
            String parentId,
            int sortOrder
    ) {
        return new Category(
                id, slug, null, name, null, parentId, null, null, null,
                null, null, true, false, null, sortOrder,
                null, null, Instant.now(), Instant.now());
    }

    private static List<Product> catalogProducts() {
        ArrayList<Product> result = new ArrayList<>();
        for (int index = 0; index < 13; index++) {
            String description = index < 5
                    ? "touring đường dài"
                    : index < 9 ? "đi phố đô thị hằng ngày" : "dual sport đường đất địa hình";
            String category = index < 4
                    ? "mu-bao-hiem-fullface"
                    : index == 12 ? "mu-bao-hiem-3-4" : "mu-bao-hiem-dual-sport";
            result.add(product(
                    "helmet-" + index, "Mũ bảo hiểm " + index, description, category,
                    1_000_000L + index * 100_000L, true,
                    index == 0 ? HomepageBlock.FEATURED_GRID : HomepageBlock.NONE,
                    index == 0 ? 1 : null));
        }
        for (int index = 0; index < 10; index++) {
            result.add(product(
                    "bag-" + index, "Balo " + index, "balo đeo lưng", "balo-tui-deo-tui-treo-xe",
                    800_000L + index * 50_000L, true, HomepageBlock.NONE, null));
        }
        for (int index = 0; index < 9; index++) {
            result.add(product(
                    "apparel-" + index, "Áo mô tô " + index, "áo touring đường dài",
                    "ao-quan-bao-ho", 1_500_000L + index * 100_000L,
                    true, HomepageBlock.NONE, null));
        }
        return result;
    }

    private static Product product(
            String slug,
            String name,
            String shortDescription,
            String categorySlug,
            long price,
            boolean inStock,
            HomepageBlock homepageBlock,
            Integer homepageOrder
    ) {
        CategorySummary category = new CategorySummary(
                categorySlug, categorySlug, null, categorySlug, true, false);
        return new Product(
                "product-" + slug,
                "SKU-" + slug,
                slug,
                null,
                name,
                shortDescription,
                null,
                null,
                category,
                List.of(category),
                null,
                List.of(),
                List.of(),
                new ProductPrice(BigDecimal.valueOf(price), null, "VND"),
                List.of(),
                inStock ? ProductStockState.IN_STOCK : ProductStockState.OUT_OF_STOCK,
                inStock,
                PublishStatus.PUBLISHED,
                false,
                null,
                homepageBlock,
                homepageOrder,
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
}
