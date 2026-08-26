package com.bigbike.bigbike_backend.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantOptionEntity;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatMessageEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatConversationJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatInteractionJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatMessageJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatOrderAttributionJpaRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class AdminChatInsightsServiceTest {

    private ChatConversationJpaRepository conversations;
    private ChatInteractionJpaRepository interactions;
    private ChatOrderAttributionJpaRepository attributions;
    private ChatMessageJpaRepository messages;
    private ProductJpaRepository products;
    private AdminChatInsightsService service;

    @BeforeEach
    void setUp() {
        conversations = mock(ChatConversationJpaRepository.class);
        interactions = mock(ChatInteractionJpaRepository.class);
        attributions = mock(ChatOrderAttributionJpaRepository.class);
        messages = mock(ChatMessageJpaRepository.class);
        products = mock(ProductJpaRepository.class);
        service = new AdminChatInsightsService(
                conversations, interactions, attributions, messages, products);
    }

    @Test
    @DisplayName("AC21: funnel reports conversation cohort through views, carts, orders and revenue")
    void funnelUsesConversationStartCohort() {
        when(conversations.countByStartedAtGreaterThanEqualAndStartedAtLessThan(any(), any()))
                .thenReturn(10L);
        when(interactions.countFunnelEventsForConversationCohort(
                eq("PRODUCT_VIEWED"), any(), any())).thenReturn(6L);
        when(interactions.countFunnelEventsForConversationCohort(
                eq("CART_ADDED"), any(), any())).thenReturn(3L);
        when(attributions.countOrdersForConversationCohort(any(), any())).thenReturn(1L);
        when(attributions.sumRevenueForConversationCohort(any(), any()))
                .thenReturn(BigDecimal.valueOf(1_590_000));

        var result = service.funnel(LocalDate.of(2026, 8, 1), LocalDate.of(2026, 8, 7));

        assertThat(result.conversations()).isEqualTo(10);
        assertThat(result.productViews()).isEqualTo(6);
        assertThat(result.cartAdds()).isEqualTo(3);
        assertThat(result.orders()).isEqualTo(1);
        assertThat(result.revenue()).isEqualByComparingTo("1590000");
        assertThat(result.conversationToViewRate()).isEqualByComparingTo("0.6000");
        assertThat(result.viewToCartRate()).isEqualByComparingTo("0.5000");
    }

    @Test
    @DisplayName("AC22: unanswered report carries the customer's preceding question and reason")
    void unansweredQuestionsAreActionable() {
        UUID conversationId = UUID.randomUUID();
        Instant askedAt = Instant.parse("2026-08-24T01:00:00Z");
        ChatMessageEntity customer = message(conversationId, "CUSTOMER", "Bảng size mẫu này đâu?", askedAt);
        ChatMessageEntity assistant = message(
                conversationId, "ASSISTANT", "Shop chưa có hướng dẫn size.", askedAt.plusSeconds(1));
        assistant.setOutcomeCode("MISSING_SIZE_GUIDE");
        when(messages.findByRoleAndCreatedAtGreaterThanEqualAndCreatedAtLessThanOrderByCreatedAtDesc(
                eq("ASSISTANT"), any(), any())).thenReturn(List.of(assistant));
        when(messages.findByConversationIdOrderByCreatedAtAsc(conversationId))
                .thenReturn(List.of(customer, assistant));

        var result = service.unanswered(
                LocalDate.of(2026, 8, 24), LocalDate.of(2026, 8, 24));

        assertThat(result).singleElement().satisfies(item -> {
            assertThat(item.customerQuestion()).isEqualTo("Bảng size mẫu này đâu?");
            assertThat(item.reason()).isEqualTo("MISSING_SIZE_GUIDE");
        });
    }

    @Test
    @DisplayName("AC25/data quality: owner sees size, specification, raw-option and accessory gaps by product")
    void dataGapListShowsEveryHighImpactGap() {
        ProductVariantOptionEntity rawColour = new ProductVariantOptionEntity();
        rawColour.setOptionName("Màu");
        rawColour.setOptionValue("ronin-red");
        ProductVariantEntity variant = new ProductVariantEntity();
        variant.setOptions(List.of(rawColour));
        ProductEntity product = new ProductEntity();
        product.setId("product-1");
        product.setSlug("mu-a");
        product.setName("Mũ A");
        product.setPublishStatus(PublishStatus.PUBLISHED);
        product.setDiscontinued(false);
        product.setVariants(List.of(variant));
        product.setAccessoryProducts(List.of());
        when(products.findAll()).thenReturn(List.of(product));

        var result = service.dataGaps();

        assertThat(result.affectedProducts()).isEqualTo(1);
        assertThat(result.missingSizeGuides()).isEqualTo(1);
        assertThat(result.missingSpecifications()).isEqualTo(1);
        assertThat(result.rawOptionProducts()).isEqualTo(1);
        assertThat(result.missingAccessoryLinks()).isEqualTo(1);
        assertThat(result.items()).singleElement().satisfies(gap -> {
            assertThat(gap.gaps()).containsExactly(
                    "MISSING_SIZE_GUIDE", "MISSING_SPECIFICATIONS", "RAW_OPTION", "NO_ACCESSORIES");
            assertThat(gap.rawOptions()).containsExactly("ronin-red");
        });
    }

    private static ChatMessageEntity message(
            UUID conversationId, String role, String content, Instant createdAt) {
        ChatMessageEntity value = new ChatMessageEntity();
        value.setId(UUID.randomUUID());
        value.setConversationId(conversationId);
        value.setRole(role);
        value.setContent(content);
        value.setCreatedAt(createdAt);
        return value;
    }
}
