package com.bigbike.bigbike_backend.service.chat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.api.chat.dto.ChatContactResponse;
import com.bigbike.bigbike_backend.api.chat.dto.ChatProductCardResponse;
import com.bigbike.bigbike_backend.domain.catalog.CategorySummary;
import com.bigbike.bigbike_backend.domain.catalog.HomepageBlock;
import com.bigbike.bigbike_backend.domain.catalog.Product;
import com.bigbike.bigbike_backend.domain.catalog.ProductHighlights;
import com.bigbike.bigbike_backend.domain.catalog.ProductPrice;
import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatConversationEntity;
import com.bigbike.bigbike_backend.service.catalog.CatalogReadService;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class ChatSalesAdvisorServiceTest {

    private CatalogReadService catalog;
    private ChatSalesAdvisorService advisor;

    @BeforeEach
    void setUp() {
        catalog = mock(CatalogReadService.class);
        advisor = new ChatSalesAdvisorService(catalog);
    }

    @Test
    @DisplayName("AC1/11/14 VI+EN: a broad question stays in browsing, asks a concrete need and never asks for contact")
    void broadQuestionNarrowsNeedWithoutSellingOrLead() {
        for (Case input : List.of(
                new Case("vi", "Shop có gì vậy?", "BROWSING", "loại hàng"),
                new Case("en", "What do you sell?", "BROWSING", "product type"))) {
            var advice = advise(conversation(), input.question(), input.lang(), null,
                    ChatToolService.ConversationContext.empty(), "Em có thể hỗ trợ.", List.of());

            assertThat(advice.salesStage()).isEqualTo(input.stage());
            assertThat(advice.products()).isEmpty();
            assertThat(advice.crossSellProducts()).isEmpty();
            assertThat(advice.nextStep().type()).isEqualTo("SHARE_NEED");
            assertThat(advice.answer()).containsIgnoringCase(input.expectedCopy());
            assertThat(advice.leadOffer()).isNull();
        }
    }

    @Test
    @DisplayName("AC2/9: comparing two models keeps exactly those models and asks one deciding priority")
    void comparisonDoesNotIntroduceThirdProductOrCrossSell() {
        List<ChatProductCardResponse> cards = List.of(card("mu-a", "Mũ A", 1_500_000),
                card("mu-b", "Mũ B", 1_700_000));

        var advice = advise(conversation(), "So sánh hai mẫu này", "vi", null,
                new ChatToolService.ConversationContext(
                        "mu-bao-hiem", null, null, null, List.of("mu-a", "mu-b"), false),
                "Mũ A nhẹ hơn; Mũ B có thêm lựa chọn size.", cards);

        assertThat(advice.salesStage()).isEqualTo("CHOOSING");
        assertThat(advice.products()).extracting(ChatProductCardResponse::slug)
                .containsExactly("mu-a", "mu-b");
        assertThat(advice.crossSellProducts()).isEmpty();
        assertThat(advice.nextStep().type()).isEqualTo("CHOOSE_PRIORITY");
    }

    @Test
    @DisplayName("AC3/6/13/15: missing size data is admitted, offered only to guests and never guessed")
    void missingSizeGuideIsHonestAndLoggedInCustomerIsNotAskedForPhone() {
        Product helmet = product("mu-a", "Mũ A", 1_500_000, null, "ECE 22.06", List.of());
        when(catalog.getProductBySlug("mu-a", "vi")).thenReturn(helmet);
        ChatProductCardResponse card = card("mu-a", "Mũ A", 1_500_000);

        var guest = advise(conversation(), "Size M có còn không?", "vi", null,
                context("mu-a"), "Size M còn hàng.", List.of(card));
        assertThat(guest.salesStage()).isEqualTo("DECIDING");
        assertThat(guest.products()).containsExactly(card);
        assertThat(guest.answer()).contains("chưa có hướng dẫn size", "không đoán số đo")
                .doesNotContainPattern("(?i)\\b(?:5[0-9]|6[0-9])\\s*cm\\b");
        assertThat(guest.leadOffer()).isNotNull();
        assertThat(guest.leadOffer().reason()).isEqualTo("SIZE_ADVICE");
        assertThat(guest.nextStep().type()).isEqualTo("LEAVE_CONTACT");

        var signedIn = advise(conversation(), "Size M có còn không?", "vi", UUID.randomUUID(),
                context("mu-a"), "Size M còn hàng.", List.of(card));
        assertThat(signedIn.leadOffer()).isNull();
        assertThat(signedIn.nextStep().type()).isEqualTo("CHOOSE_SIZE");
        assertThat(signedIn.answer()).doesNotContain("để lại số");
    }

    @Test
    @DisplayName("AC4: post-purchase questions stay on the customer's order and do not cross-sell")
    void postPurchaseDoesNotSell() {
        var advice = advise(conversation(), "Đơn của tôi đang giao tới đâu?", "vi", UUID.randomUUID(),
                ChatToolService.ConversationContext.empty(),
                "Đơn BB-01 đang được xử lý.", List.of());

        assertThat(advice.salesStage()).isEqualTo("POST_PURCHASE");
        assertThat(advice.crossSellProducts()).isEmpty();
        assertThat(advice.nextStep().type()).isEqualTo("VIEW_ORDER");
    }

    @Test
    @DisplayName("AC5: a price objection receives a cheaper same-category model and an explicit trade-off")
    void priceObjectionUsesVerifiedCheaperAlternativeWithoutDiscounting() {
        Product baseline = product("mu-premium", "Mũ Premium", 2_000_000,
                "M: 57-58 cm", "ECE 22.06", List.of());
        Product cheaper = product("mu-tiet-kiem", "Mũ Tiết Kiệm", 1_500_000,
                null, null, List.of());
        when(catalog.getProductBySlug("mu-premium", "vi")).thenReturn(baseline);
        when(catalog.getProductBySlug("mu-tiet-kiem", "vi")).thenReturn(cheaper);
        when(catalog.listAssistantDecisionProducts("vi")).thenReturn(List.of(baseline, cheaper));

        var advice = advise(conversation(), "Mẫu này đắt quá", "vi", null,
                context("mu-premium"), "Giá là 2.000.000đ.",
                List.of(card("mu-premium", "Mũ Premium", 2_000_000)));

        assertThat(advice.products()).extracting(ChatProductCardResponse::slug)
                .containsExactly("mu-tiet-kiem");
        assertThat(advice.answer()).contains("thấp hơn", "Đánh đổi", "không tự hạ giá niêm yết");
        assertThat(advice.nextStep().type()).isEqualTo("VIEW_CHEAPER_ALTERNATIVE");
    }

    @Test
    @DisplayName("AC7/23/24: authenticity uses only the published warranty copy")
    void authenticityUsesPublishedWarranty() {
        var advice = advisor.advise(
                conversation(), "Hàng có chính hãng không?", "vi", null, settings(),
                ChatToolService.ConversationContext.empty(), "Có ạ.", List.of(),
                "TOOL", "ANSWER", null, false, List.of());

        assertThat(advice.answer()).contains("Chính sách bảo hành", "bảo hành theo điều kiện công bố")
                .doesNotContain("nhiều khách", "bán chạy", "sắp hết", "giảm giá");
    }

    @Test
    @DisplayName("AC8/10: only explicitly linked, published in-stock accessories are offered, at most two")
    void crossSellUsesOnlyExplicitEligibleLinks() {
        Product first = product("kinh-1", "Kính 1", 300_000, null, null, List.of());
        Product second = product("tai-nghe-1", "Tai nghe 1", 900_000, null, null, List.of());
        Product third = product("ao-mua-1", "Áo mưa 1", 500_000, null, null, List.of());
        Product main = product("mu-a", "Mũ A", 1_500_000, "M: 57-58 cm", "ECE", List.of(first, second, third));
        when(catalog.getProductBySlug("mu-a", "vi")).thenReturn(main);

        var advice = advise(conversation(), "Tôi chốt lấy mẫu này", "vi", null,
                context("mu-a"), "Mẫu này còn hàng.", List.of(card("mu-a", "Mũ A", 1_500_000)));

        assertThat(advice.crossSellProducts()).hasSize(2)
                .extracting(ChatProductCardResponse::slug)
                .containsExactly("kinh-1", "tai-nghe-1");
        assertThat(advice.nextStep().type()).isEqualTo("VIEW_ACCESSORIES");

        Product noLinks = product("mu-b", "Mũ B", 1_300_000, "M: 57-58 cm", "ECE", List.of());
        when(catalog.getProductBySlug("mu-b", "vi")).thenReturn(noLinks);
        var none = advise(conversation(), "Tôi chốt lấy mẫu này", "vi", null,
                context("mu-b"), "Mẫu này còn hàng.", List.of(card("mu-b", "Mũ B", 1_300_000)));
        assertThat(none.crossSellProducts()).isEmpty();
    }

    @Test
    @DisplayName("AC12/16: declining a proposal suppresses it and contact is never re-offered")
    void declinedProposalBecomesLowPressurePause() {
        ChatConversationEntity conversation = conversation();
        conversation.setLastNextStepType("ADD_TO_CART");
        conversation.setLeadOfferStatus("DECLINED");

        var advice = advise(conversation, "Để tôi xem thêm đã", "vi", null,
                ChatToolService.ConversationContext.empty(), "Vâng ạ.", List.of());

        assertThat(conversation.getDeclinedNextStepType()).isEqualTo("ADD_TO_CART");
        assertThat(advice.nextStep().type()).isEqualTo("PAUSE");
        assertThat(advice.leadOffer()).isNull();
        assertThat(advice.answer()).doesNotContain("thêm vào giỏ", "để lại số");
    }

    @Test
    @DisplayName("AC2-16 EN: English follows the same stage, concern, cross-sell, lead and decline rules")
    void englishRulesMirrorVietnameseRules() {
        Product accessory = product("visor-a", "Visor A", 300_000, null, null, List.of());
        Product helmet = product(
                "helmet-a", "Helmet A", 2_000_000, null, "ECE 22.06", List.of(accessory));
        Product cheaper = product(
                "helmet-b", "Helmet B", 1_500_000, null, null, List.of());
        when(catalog.getProductBySlug("helmet-a", "en")).thenReturn(helmet);
        when(catalog.getProductBySlug("helmet-b", "en")).thenReturn(cheaper);
        when(catalog.listAssistantDecisionProducts("en")).thenReturn(List.of(helmet, cheaper));
        ChatToolService.ConversationContext focus = new ChatToolService.ConversationContext(
                "helmets", null, null, null, List.of("helmet-a"), false);
        ChatProductCardResponse helmetCard = card("helmet-a", "Helmet A", 2_000_000);

        var size = advise(conversation(), "Is size M available?", "en", null,
                focus, "Size M is available.", List.of(helmetCard));
        assertThat(size.salesStage()).isEqualTo("DECIDING");
        assertThat(size.answer()).contains("does not yet have a size guide", "will not guess");
        assertThat(size.leadOffer().reason()).isEqualTo("SIZE_ADVICE");
        assertThat(size.crossSellProducts()).isEmpty();

        var signedInSize = advise(conversation(), "Is size M available?", "en", UUID.randomUUID(),
                focus, "Size M is available.", List.of(helmetCard));
        assertThat(signedInSize.leadOffer()).isNull();
        assertThat(signedInSize.answer()).doesNotContain("phone number");

        var comparison = advise(conversation(), "Compare these two models", "en", null,
                new ChatToolService.ConversationContext(
                        "helmets", null, null, null, List.of("helmet-a", "helmet-b"), false),
                "Helmet A has one feature; Helmet B has another.",
                List.of(helmetCard, card("helmet-b", "Helmet B", 1_500_000)));
        assertThat(comparison.products()).hasSize(2);
        assertThat(comparison.crossSellProducts()).isEmpty();
        assertThat(comparison.nextStep().type()).isEqualTo("CHOOSE_PRIORITY");

        var price = advise(conversation(), "This model is too expensive", "en", null,
                focus, "The current price is listed.", List.of(helmetCard));
        assertThat(price.products()).extracting(ChatProductCardResponse::slug)
                .containsExactly("helmet-b");
        assertThat(price.answer()).contains("costs", "less", "trade-off")
                .contains("cannot lower the listed price");

        var decided = advise(conversation(), "I will take this model", "en", null,
                focus, "This model is in stock.", List.of(helmetCard));
        assertThat(decided.crossSellProducts()).extracting(ChatProductCardResponse::slug)
                .containsExactly("visor-a");

        var authenticity = advisor.advise(
                conversation(), "Is this genuine?", "en", null, englishSettings(),
                focus, "Yes.", List.of(helmetCard), "TOOL", "PRODUCT_RESULTS",
                null, false, List.of());
        assertThat(authenticity.answer()).contains("Published warranty", "published terms")
                .doesNotContain("customers love", "best seller", "few left");

        var postPurchase = advise(conversation(), "Where is my order?", "en", UUID.randomUUID(),
                ChatToolService.ConversationContext.empty(), "Your order is being processed.", List.of());
        assertThat(postPurchase.salesStage()).isEqualTo("POST_PURCHASE");
        assertThat(postPurchase.crossSellProducts()).isEmpty();

        ChatConversationEntity declinedConversation = conversation();
        declinedConversation.setLastNextStepType("ADD_TO_CART");
        declinedConversation.setLeadOfferStatus("DECLINED");
        var declined = advise(declinedConversation, "Let me look around first", "en", null,
                ChatToolService.ConversationContext.empty(), "Of course.", List.of());
        assertThat(declined.nextStep().type()).isEqualTo("PAUSE");
        assertThat(declined.leadOffer()).isNull();
        assertThat(declined.answer()).doesNotContain("Add this model", "phone number");
    }

    private ChatSalesAdvisorService.Advice advise(
            ChatConversationEntity conversation,
            String question,
            String lang,
            UUID customerId,
            ChatToolService.ConversationContext context,
            String answer,
            List<ChatProductCardResponse> products
    ) {
        return advisor.advise(
                conversation, question, lang, customerId, settings(), context, answer, products,
                "TOOL", products.isEmpty() ? "ANSWER" : "PRODUCT_RESULTS",
                null, false, List.of());
    }

    private static ChatConversationEntity conversation() {
        ChatConversationEntity value = new ChatConversationEntity();
        value.setLocale("vi");
        return value;
    }

    private static ChatToolService.ConversationContext context(String slug) {
        return new ChatToolService.ConversationContext(
                "mu-bao-hiem", null, null, null, List.of(slug), false);
    }

    private static ChatAssistantSettings.Snapshot settings() {
        return new ChatAssistantSettings.Snapshot(
                true, 400, true, "Xin chào", List.of("A", "B", "C"),
                new ChatContactResponse("0900", "", "", "", ""),
                "123 BigBike", "08:00-18:00", "08:00-17:00", 12,
                BigDecimal.ZERO, List.of(), List.of(),
                ChatAssistantSettings.BankDetails.empty(),
                new ChatAssistantSettings.PolicyText(
                        "Chính sách bảo hành", "Sản phẩm được bảo hành theo điều kiện công bố."),
                ChatAssistantSettings.PolicyText.empty());
    }

    private static ChatAssistantSettings.Snapshot englishSettings() {
        return new ChatAssistantSettings.Snapshot(
                true, 400, true, "Hello", List.of("A", "B", "C"),
                new ChatContactResponse("0900", "", "", "", ""),
                "123 BigBike", "08:00-18:00", "08:00-17:00", 12,
                BigDecimal.ZERO, List.of(), List.of(),
                ChatAssistantSettings.BankDetails.empty(),
                new ChatAssistantSettings.PolicyText(
                        "Published warranty", "Warranty follows the published terms."),
                ChatAssistantSettings.PolicyText.empty());
    }

    private static ChatProductCardResponse card(String slug, String name, long price) {
        return new ChatProductCardResponse(
                slug, name, null, BigDecimal.valueOf(price), null, "VND", "IN_STOCK");
    }

    private static Product product(
            String slug,
            String name,
            long price,
            String sizeGuide,
            String specifications,
            List<Product> accessories
    ) {
        CategorySummary category = new CategorySummary(
                "category-helmet", "mu-bao-hiem", null, "Mũ bảo hiểm", true, false);
        return new Product(
                "product-" + slug,
                "SKU-" + slug,
                slug,
                null,
                name,
                null,
                null,
                null,
                category,
                List.of(category),
                null,
                List.of(),
                List.of(),
                new ProductPrice(BigDecimal.valueOf(price), null, "VND"),
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
                sizeGuide,
                null,
                specifications,
                null,
                null,
                null,
                List.of(),
                List.of(),
                accessories,
                null,
                null,
                null,
                null,
                null,
                Instant.now(),
                Instant.now());
    }

    private record Case(String lang, String question, String stage, String expectedCopy) {}
}
