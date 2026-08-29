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
import org.junit.jupiter.api.Test;

class ChatSalesAdvisorServiceTest {

    @Test
    void broadQuestionNarrowsTheNeedWithoutAskingForContactDetails() {
        ChatSalesAdvisorService advisor = new ChatSalesAdvisorService(mock(CatalogReadService.class));

        var advice = advisor.advise(conversation(), "Shop có gì vậy?", "vi", settings(),
                ChatToolService.ConversationContext.empty(), "Em có thể hỗ trợ.", List.of(),
                "TOOL", "ANSWER", null, false, List.of());

        assertThat(advice.salesStage()).isEqualTo("BROWSING");
        assertThat(advice.nextStep().type()).isEqualTo("SHARE_NEED");
        assertThat(advice.answer()).contains("loại hàng").doesNotContain("số điện thoại");
    }

    @Test
    void missingSizeGuideIsAdmittedWithoutGuessingMeasurementsOrCapturingContact() {
        CatalogReadService catalog = mock(CatalogReadService.class);
        Product helmet = product("mu-a", "Mũ A", 1_500_000, null);
        when(catalog.getProductBySlug("mu-a", "vi")).thenReturn(helmet);
        ChatSalesAdvisorService advisor = new ChatSalesAdvisorService(catalog);

        var advice = advisor.advise(conversation(), "Size M có còn không?", "vi", settings(),
                context("mu-a"), "Size M còn hàng.", List.of(card("mu-a", "Mũ A", 1_500_000)),
                "TOOL", "PRODUCT_RESULTS", null, false, List.of());

        assertThat(advice.salesStage()).isEqualTo("DECIDING");
        assertThat(advice.nextStep().type()).isEqualTo("CHOOSE_SIZE");
        assertThat(advice.answer()).contains("chưa có hướng dẫn size", "không đoán số đo")
                .doesNotContainPattern("(?i)\\b(?:5[0-9]|6[0-9])\\s*cm\\b")
                .doesNotContain("để lại số");
    }

    @Test
    void priceObjectionOffersOnlyAVerifiedCheaperSameCategoryAlternative() {
        CatalogReadService catalog = mock(CatalogReadService.class);
        Product baseline = product("mu-premium", "Mũ Premium", 2_000_000, "M: 57-58 cm");
        Product cheaper = product("mu-tiet-kiem", "Mũ Tiết Kiệm", 1_500_000, null);
        when(catalog.getProductBySlug("mu-premium", "vi")).thenReturn(baseline);
        when(catalog.getProductBySlug("mu-tiet-kiem", "vi")).thenReturn(cheaper);
        when(catalog.listAssistantDecisionProducts("vi")).thenReturn(List.of(baseline, cheaper));
        ChatSalesAdvisorService advisor = new ChatSalesAdvisorService(catalog);

        var advice = advisor.advise(conversation(), "Mẫu này đắt quá", "vi", settings(),
                context("mu-premium"), "Giá đang niêm yết.",
                List.of(card("mu-premium", "Mũ Premium", 2_000_000)),
                "TOOL", "PRODUCT_RESULTS", null, false, List.of());

        assertThat(advice.products()).extracting(ChatProductCardResponse::slug)
                .containsExactly("mu-tiet-kiem");
        assertThat(advice.answer()).contains("Đánh đổi", "không tự hạ giá niêm yết");
        assertThat(advice.nextStep().type()).isEqualTo("VIEW_CHEAPER_ALTERNATIVE");
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
                "", "", "", 12,
                ChatAssistantSettings.BankDetails.empty(),
                new ChatAssistantSettings.PolicyText(
                        "Chính sách bảo hành", "Sản phẩm được bảo hành theo điều kiện công bố."),
                ChatAssistantSettings.PolicyText.empty());
    }

    private static ChatProductCardResponse card(String slug, String name, long price) {
        return new ChatProductCardResponse(
                slug, name, null, BigDecimal.valueOf(price), null, "VND", "IN_STOCK");
    }

    private static Product product(String slug, String name, long price, String sizeGuide) {
        CategorySummary category = new CategorySummary(
                "category-helmet", "mu-bao-hiem", null, "Mũ bảo hiểm", true, false);
        return new Product(
                "product-" + slug, "SKU-" + slug, slug, null, name, null, null, null,
                category, List.of(category), null, List.of(), List.of(),
                new ProductPrice(BigDecimal.valueOf(price), null, "VND"), List.of(),
                ProductStockState.IN_STOCK, Boolean.TRUE, PublishStatus.PUBLISHED, false, null,
                HomepageBlock.NONE, null, null, null, List.of(), List.of(), ProductHighlights.EMPTY,
                null, sizeGuide, null, null, null, null, null, List.of(), List.of(), List.of(),
                null, null, null, null, null, Instant.now(), Instant.now());
    }
}
