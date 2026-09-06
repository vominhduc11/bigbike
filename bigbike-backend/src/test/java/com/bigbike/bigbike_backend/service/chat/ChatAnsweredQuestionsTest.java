package com.bigbike.bigbike_backend.service.chat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
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
import com.bigbike.bigbike_backend.service.content.StorePolicyService;
import com.bigbike.bigbike_backend.service.order.OrderReadService;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * The questions the assistant refused to answer in the 2026-09-06 review on the live shop.
 * Every one of them returned a technical apology instead of a reply; none may do so again.
 */
class ChatAnsweredQuestionsTest {

    private final ChatResponseGuard guard = new ChatResponseGuard();
    private CatalogReadService catalog;
    private ChatToolService tools;

    @BeforeEach
    void setUp() {
        catalog = mock(CatalogReadService.class);
        tools = new ChatToolService(catalog, mock(OrderReadService.class));
        List<Category> categories = List.of(
                category("helmet-root", "mu-bao-hiem", "Mũ bảo hiểm"),
                category("gloves-root", "gang-tay-xe-may-moto", "Găng tay xe máy moto"));
        when(catalog.listAssistantCategories(anyString())).thenReturn(categories);
        when(catalog.listAssistantDecisionProducts(anyString())).thenReturn(List.of(HELMET, GLOVE));
        when(catalog.getProductBySlug("mu-ls2-of626", "vi")).thenReturn(HELMET);
        when(catalog.getProductBySlug("gang-tay-taichi-rst463", "vi")).thenReturn(GLOVE);
        when(catalog.assistantCompletedSales(anyList()))
                .thenReturn(new CatalogReadService.AssistantSalesSnapshot(0, List.of()));
    }

    @Test
    @DisplayName("the warranty question is answered from the published policy, not refused")
    void warrantyQuestionIsAnswered() {
        ChatToolService.ToolOutcome outcome = answer("Chính sách bảo hành của shop thế nào?");

        assertThat(outcome.localAnswer()).contains("Chính sách bảo hành");
        assertThat(outcome.aiRequired()).isFalse();
        assertThat(guard.check(outcome.localAnswer(), outcome.products(), "vi")).isPresent();
    }

    @Test
    @DisplayName("the return question answers the part that was asked and points at the full page")
    void returnQuestionIsShortAndTargeted() {
        ChatToolService.ToolOutcome outcome = answer("Ai chịu phí ship khi đổi trả hàng?");

        assertThat(outcome.localAnswer()).contains("phí vận chuyển");
        assertThat(outcome.localAnswer()).doesNotContain("Quy trình đổi / trả hàng");
        assertThat(outcome.localAnswer().length()).isLessThan(1_200);
        assertThat(guard.check(outcome.localAnswer(), outcome.products(), "vi")).isPresent();
    }

    @Test
    @DisplayName("a helmet-law question is declined politely, never with a technical apology")
    void trafficLawQuestionIsDeclinedPolitely() {
        ChatToolService.ToolOutcome outcome =
                answer("Luật giao thông có bắt buộc đội mũ fullface không?");

        assertThat(outcome.localAnswer()).contains("không tư vấn quy định pháp luật");
        assertThat(outcome.localAnswer()).doesNotContain("chưa hoàn tất");
        assertThat(guard.check(outcome.localAnswer(), outcome.products(), "vi")).isPresent();
    }

    @Test
    @DisplayName("bargaining gets a sales answer and a way to reach the shop")
    void bargainingIsAnswered() {
        for (String question : List.of(
                "Bên shop khác bán rẻ hơn 500k, sao tôi phải mua chỗ bạn?",
                "Giảm giá cho tôi 50% được không, tôi mua 2 cái?")) {
            ChatToolService.ToolOutcome outcome = answer(question);

            assertThat(outcome.localAnswer()).as(question).contains("Hotline");
            assertThat(outcome.localAnswer()).as(question).doesNotContain("chưa hoàn tất");
            assertThat(outcome.aiRequired()).as(question).isFalse();
            assertThat(outcome.directContactRecommended()).as(question).isTrue();
            assertThat(guard.check(outcome.localAnswer(), outcome.products(), "vi"))
                    .as(question).isPresent();
        }
    }

    @Test
    @DisplayName("asking whether the gold price fell is not read as haggling over shop prices")
    void goldPriceIsNotTreatedAsBargaining() {
        // "Có giảm không" is bargaining wording, but this question is not about buying here.
        // It must keep going down the normal out-of-scope path instead of getting a sales reply.
        Optional<ChatToolService.ToolOutcome> outcome = tools.resolveFastPath(
                "Giá vàng SJC hôm nay có giảm không?", "vi", null, settings(),
                ChatToolService.ConversationContext.empty());

        assertThat(outcome.map(ChatToolService.ToolOutcome::localAnswer).orElse(""))
                .doesNotContain("giá bán hiện hành của BigBike");
    }

    @Test
    @DisplayName("the shop's scope boundary is a rule, not a model preference")
    void outOfScopeSubjectsAreBlockedDeterministically() {
        // Before 2026-09-06 these were only declined when the model felt like declining, so the
        // "12/12 blocked" figure could not be reproduced on demand.
        for (String question : List.of(
                "Giá vàng SJC hôm nay bao nhiêu?",
                "Đội tuyển Việt Nam đá với Thái Lan mấy giờ?",
                "Tôi bị đau đầu chóng mặt mấy hôm nay, nên uống thuốc gì?",
                "Giải giúp tôi bài toán 15 x 24 bằng bao nhiêu")) {
            ChatToolService.ToolOutcome outcome = answer(question);
            assertThat(outcome.offTopic()).as(question).isTrue();
            assertThat(outcome.products()).as(question).isEmpty();
        }
    }

    @Test
    @DisplayName("shop questions in natural wording still reach the store details")
    void shopFactsAreRecognisedInNaturalWording() {
        for (String question : List.of("Shop mình ở đâu vậy?", "Mấy giờ shop đóng cửa?")) {
            ChatToolService.ToolOutcome outcome = answer(question);
            assertThat(outcome.localAnswer()).as(question).contains("Hotline");
            assertThat(outcome.products()).as(question).isEmpty();
        }
    }

    @Test
    @DisplayName("a model shown two topics ago is still found by 'cái mũ lúc nãy'")
    void olderProductIsStillRemembered() {
        // Gloves were the most recent list; the helmet was shown before them.
        ChatToolService.ConversationContext context = new ChatToolService.ConversationContext(
                "gang-tay-xe-may-moto", null, null, null,
                List.of("gang-tay-taichi-rst463"), false, null,
                List.of("gang-tay-taichi-rst463", "mu-ls2-of626"));

        ChatToolService.ToolOutcome outcome = tools.resolveFastPath(
                "Cái mũ lúc nãy còn size L không?", "vi", null, settings(), context).orElseThrow();

        assertThat(outcome.products()).isNotEmpty();
        assertThat(outcome.products().stream().map(ChatProductCardResponse::slug))
                .containsExactly("mu-ls2-of626");
    }

    private ChatToolService.ToolOutcome answer(String question) {
        return tools.resolveFastPath(
                        question, "vi", null, settings(),
                        ChatToolService.ConversationContext.empty())
                .orElseThrow(() -> new AssertionError(
                        "Trợ lý phải trả lời được câu này mà không cần gọi AI: " + question));
    }

    private static ChatAssistantSettings.Snapshot settings() {
        return new ChatAssistantSettings.Snapshot(
                true, 60, true,
                new ChatContactResponse("0900 000 000", "https://zalo.example",
                        "https://messenger.example", "Zalo", "Messenger"),
                "12 Đường Số 1", "08:00 - 20:00", "09:00 - 18:00", 12,
                ChatAssistantSettings.BankDetails.empty(),
                warrantyPolicy(), returnPolicy());
    }

    private static ChatAssistantSettings.PolicyText warrantyPolicy() {
        return new ChatAssistantSettings.PolicyText(
                "Chính sách bảo hành",
                "BigBike cam kết bảo hành chính hãng theo đúng quy định của từng nhà sản xuất.",
                List.of(
                        new StorePolicyService.PolicySection("",
                                "BigBike cam kết bảo hành chính hãng theo đúng quy định của từng nhà sản xuất."),
                        new StorePolicyService.PolicySection("1. Điều kiện được bảo hành",
                                "Lỗi nhà sản xuất về vật liệu, đường may và kết cấu. "
                                        + "Sản phẩm còn trong thời hạn bảo hành và còn tem."),
                        new StorePolicyService.PolicySection("2. Thời hạn bảo hành theo thương hiệu",
                                "SCS 24 tháng. Toàn bộ sản phẩm được áp dụng, trừ va đập và vào nước.")));
    }

    private static ChatAssistantSettings.PolicyText returnPolicy() {
        return new ChatAssistantSettings.PolicyText(
                "Chính sách đổi trả",
                "BigBike hỗ trợ đổi trả theo đúng điều kiện đã công bố.",
                List.of(
                        new StorePolicyService.PolicySection("1. Thời hạn đổi và trả hàng",
                                "Khách đổi hoặc trả trong 7 ngày kể từ khi nhận hàng."),
                        new StorePolicyService.PolicySection("2. Điều kiện được đổi / trả",
                                "Sản phẩm còn nguyên tem, chưa qua sử dụng và còn hộp."),
                        new StorePolicyService.PolicySection("4. Phí vận chuyển khi đổi / trả",
                                "Lỗi từ BigBike thì shop chịu phí vận chuyển hai chiều. "
                                        + "Đổi vì lý do cá nhân thì khách chịu phí gửi hàng về."),
                        new StorePolicyService.PolicySection("5. Quy trình đổi / trả hàng",
                                "Khách liên hệ shop, gửi ảnh sản phẩm rồi gửi hàng về theo hướng dẫn.")));
    }

    private static final Product HELMET = product(
            "mu-ls2-of626", "Mũ bảo hiểm 3/4 LS2 OF626", "mu-bao-hiem", 1_890_000L);
    private static final Product GLOVE = product(
            "gang-tay-taichi-rst463", "Găng tay moto Taichi RST463",
            "gang-tay-xe-may-moto", 890_000L);

    private static Category category(String id, String slug, String name) {
        return new Category(
                id, slug, null, name, null, null, null, null, null,
                null, null, true, false, null, 1,
                null, null, Instant.now(), Instant.now());
    }

    private static Product product(String slug, String name, String categorySlug, long price) {
        return product(slug, name, name, categorySlug, price, true, HomepageBlock.FEATURED_GRID, 1);
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
