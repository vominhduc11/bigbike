package com.bigbike.bigbike_backend.service.chat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.domain.catalog.BrandSummary;
import com.bigbike.bigbike_backend.domain.catalog.CategorySummary;
import com.bigbike.bigbike_backend.domain.catalog.HomepageBlock;
import com.bigbike.bigbike_backend.domain.catalog.Product;
import com.bigbike.bigbike_backend.domain.catalog.ProductHighlights;
import com.bigbike.bigbike_backend.domain.catalog.ProductPrice;
import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatConversationEntity;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatImageEntity;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatConversationJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatImageJpaRepository;
import com.bigbike.bigbike_backend.service.catalog.CatalogReadService;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class ChatImageServiceTest {

    @Test
    void exactCatalogSimilarityIsQualifiedInVietnameseAndEnglish() {
        for (String lang : List.of("vi", "en")) {
            Fixture fixture = fixture(lang);
            fixture.visualMatch("mu-tanami");
            fixture.analysis(new ChatImageAnalysisClient.ImageAnalysis(
                    "PRODUCT_SEARCH", "Mũ bảo hiểm", "HIGH",
                    List.of("mu-tanami"), false));

            ChatImageService.ImageTurnResult result = fixture.process("Shop có bán mẫu này không?");

            assertThat(result.products()).extracting(item -> item.slug())
                    .containsExactly("mu-tanami");
            if ("vi".equals(lang)) {
                assertThat(result.answer())
                        .contains("trông giống mẫu Mũ Tanami bên em đang bán")
                        .contains("không phải khẳng định cùng một sản phẩm")
                        .doesNotContain("đây chính là");
            } else {
                assertThat(result.answer())
                        .contains("looks similar to Mũ Tanami")
                        .contains("not confirmation that it is the same product")
                        .doesNotContain("this is exactly");
            }
        }
    }

    @Test
    void unknownOrNotSoldImageNeverInventsACatalogMatch() {
        for (String lang : List.of("vi", "en")) {
            Fixture fixture = fixture(lang);
            fixture.analysis(new ChatImageAnalysisClient.ImageAnalysis(
                    "PRODUCT_SEARCH", "UNKNOWN", "HIGH",
                    List.of("slug-khong-co-trong-shop"), false));

            ChatImageService.ImageTurnResult result = fixture.process("Shop có mẫu này không?");

            assertThat(result.products()).isEmpty();
            assertThat(result.resultKind()).isEqualTo("CLARIFICATION");
            assertThat(result.answer()).contains("vi".equals(lang)
                    ? "chưa nhận ra đáng tin cậy" : "cannot recognize a specific product reliably");
            assertThat(result.answer()).doesNotContain("slug-khong-co-trong-shop");
        }
    }

    @Test
    void recognizedGroupShowsOnlyRealInStockGroupProductsWithoutClaimingIdentity() {
        for (String lang : List.of("vi", "en")) {
            Fixture fixture = fixture(lang);
            fixture.analysis(new ChatImageAnalysisClient.ImageAnalysis(
                    "PRODUCT_SEARCH", "Mũ bảo hiểm", "MEDIUM", List.of(), false));

            ChatImageService.ImageTurnResult result = fixture.process("Đây là loại gì?");

            assertThat(result.products()).extracting(item -> item.slug())
                    .containsExactly("mu-tanami");
            assertThat(result.answer()).contains("vi".equals(lang)
                    ? "không khẳng định mẫu nào là cùng sản phẩm"
                    : "not claiming any is the same product");
        }
    }

    @Test
    void damageCaptionOverridesModelAndNeverDecidesWarranty() {
        assertHighRiskCopy(
                "vi", "Mũ này bị nứt, có chắc chắn được bảo hành không?",
                "bị lỗi/hỏng", "không tự kết luận bảo hành");
        assertHighRiskCopy(
                "en", "This helmet is broken. Is warranty guaranteed?",
                "damaged-product image", "cannot decide warranty eligibility");
    }

    @Test
    void headOrPersonPhotoNeverGuessesSizeInEitherLanguage() {
        assertHighRiskCopy(
                "vi", "Nhìn đầu tôi thì size nào vừa?",
                "không đoán size", "dùng thước dây");
        assertHighRiskCopy(
                "en", "What size fits me from this head photo?",
                "cannot estimate a helmet size", "measuring tape");
    }

    @Test
    void orderDocumentAndUnrelatedImagesUseBoundedBilingualResponses() {
        for (String lang : List.of("vi", "en")) {
            Fixture order = fixture(lang);
            order.analysis(new ChatImageAnalysisClient.ImageAnalysis(
                    "ORDER_DOCUMENT", "UNKNOWN", "HIGH", List.of(), false));
            assertThat(order.process("Ảnh đơn hàng").answer()).contains("vi".equals(lang)
                    ? "không dùng số hoặc chữ trên ảnh để khẳng định"
                    : "cannot use numbers or text in this image to confirm an order");

            Fixture unrelated = fixture(lang);
            unrelated.analysis(new ChatImageAnalysisClient.ImageAnalysis(
                    "UNRELATED", "UNKNOWN", "HIGH", List.of(), false));
            ChatImageService.ImageTurnResult refusal = unrelated.process("Xem ảnh này giúp tôi");
            assertThat(refusal.resultKind()).isEqualTo("REFUSAL");
            assertThat(refusal.answer()).contains("vi".equals(lang)
                    ? "sản phẩm, đồ bảo hộ" : "BigBike products, protective gear");
        }
    }

    @Test
    void dailyImageLimitLeavesTextChatAvailableAndDoesNotCallProvider() {
        for (String lang : List.of("vi", "en")) {
            Fixture fixture = fixture(lang);
            when(fixture.quotaService.tryReserve(anyInt())).thenReturn(false);

            ChatImageService.ImageTurnResult result = fixture.process("Mẫu này còn không?");

            assertThat(result.analyzed()).isFalse();
            assertThat(result.answer()).contains("vi".equals(lang)
                    ? "vẫn có thể mô tả sản phẩm bằng chữ"
                    : "still describe the item in text");
            verify(fixture.analysisClient, never()).analyze(
                    any(), anyString(), anyString(), any(), any());
        }
    }

    @Test
    void imageTurnIgnoresRetiredToggleAndKeepsTheVerifiedQuotas() {
        Fixture fixture = fixture("vi");
        when(fixture.assistantSettings.imageSettings())
                .thenReturn(new ChatAssistantSettings.ImageSettings(false, 20, 3));
        fixture.analysis(new ChatImageAnalysisClient.ImageAnalysis(
                "PRODUCT_SEARCH", "Mũ bảo hiểm", "MEDIUM", List.of(), false));

        ChatImageService.ImageTurnResult result = fixture.process("Đây là loại gì?");

        assertThat(result.analyzed()).isTrue();
        verify(fixture.quotaService).tryReserve(20);
        verify(fixture.analysisClient).analyze(
                any(), anyString(), anyString(), any(), any());
    }

    @Test
    void unsafeImageIsImmediatelyHiddenAndItsObjectIsDeleted() {
        Fixture fixture = fixture("vi");
        fixture.analysis(new ChatImageAnalysisClient.ImageAnalysis(
                "UNKNOWN", "UNKNOWN", "LOW", List.of(), true));

        ChatImageService.ImageTurnResult result = fixture.process("Xem ảnh này");

        assertThat(result.source()).isEqualTo("CONTENT_REFUSAL");
        assertThat(fixture.image.getStatus()).isEqualTo("REJECTED_UNSAFE");
        assertThat(fixture.image.getDeletedAt()).isNotNull();
        verify(fixture.storageService).delete("private", "chat/object.jpg");
        assertThat(fixture.service.referencesByMessageIds(List.of(fixture.messageId))).isEmpty();
    }

    @Test
    void customerContentRequiresConversationOwnership() {
        Fixture fixture = fixture("vi");
        UUID stranger = UUID.randomUUID();
        when(fixture.conversationRepo.findById(fixture.conversation.getId()))
                .thenReturn(Optional.of(fixture.conversation));

        assertThatThrownBy(() -> fixture.service.customerContent(
                fixture.image.getId(), stranger, null))
                .isInstanceOf(NotFoundException.class);
        verify(fixture.storageService, never()).read(anyString(), anyString(), anyString());
    }

    @Test
    void deletingConversationDeletesPrivateObjectBeforeDatabaseRows() {
        Fixture fixture = fixture("vi");
        when(fixture.imageRepo.findByConversationIds(List.of(fixture.conversation.getId())))
                .thenReturn(List.of(fixture.image));

        assertThat(fixture.service.deleteForConversations(List.of(fixture.conversation.getId())))
                .isTrue();

        verify(fixture.storageService).delete("private", "chat/object.jpg");
        verify(fixture.imageRepo).deleteAll(List.of(fixture.image));
        assertThat(fixture.image.getStatus()).isEqualTo("DELETED");
        assertThat(fixture.image.getDeletedAt()).isNotNull();
    }

    @Test
    void pendingImageOlderThanOneHourDeletesOnlyThatPrivateObject() {
        Fixture fixture = fixture("vi");
        Instant cutoff = Instant.parse("2026-08-26T10:00:00Z");
        fixture.image.setCreatedAt(cutoff.minusSeconds(3601));
        when(fixture.imageRepo.findByExpiresAtBeforeOrderByExpiresAtAsc(cutoff))
                .thenReturn(List.of());
        when(fixture.imageRepo.findByStatusAndCreatedAtBeforeOrderByCreatedAtAsc(
                "PENDING", cutoff.minusSeconds(3600))).thenReturn(List.of(fixture.image));

        assertThat(fixture.service.deleteExpiredImages(cutoff)).isEqualTo(1);

        verify(fixture.storageService).delete("private", "chat/object.jpg");
        verify(fixture.imageRepo).delete(fixture.image);
    }

    private static void assertHighRiskCopy(
            String lang, String caption, String expectedOne, String expectedTwo) {
        Fixture fixture = fixture(lang);
        fixture.analysis(new ChatImageAnalysisClient.ImageAnalysis(
                "PRODUCT_SEARCH", "Mũ bảo hiểm", "HIGH",
                List.of("mu-tanami"), false));

        ChatImageService.ImageTurnResult result = fixture.process(caption);

        assertThat(result.answer()).contains(expectedOne, expectedTwo);
        assertThat(result.products()).isEmpty();
        if (caption.toLowerCase().contains("nứt") || caption.toLowerCase().contains("broken")) {
            assertThat(result.answer()).doesNotContain(
                    "chắc chắn được bảo hành", "warranty is guaranteed");
        }
    }

    private static Fixture fixture(String lang) {
        ChatImageJpaRepository imageRepo = mock(ChatImageJpaRepository.class);
        ChatConversationJpaRepository conversationRepo = mock(ChatConversationJpaRepository.class);
        ChatAssistantSettings assistantSettings = mock(ChatAssistantSettings.class);
        ChatImageStorageService storageService = mock(ChatImageStorageService.class);
        ChatImageDailyQuotaService quotaService = mock(ChatImageDailyQuotaService.class);
        ChatImageAnalysisClient analysisClient = mock(ChatImageAnalysisClient.class);
        CatalogReadService catalog = mock(CatalogReadService.class);
        ChatProductImageFingerprintService fingerprints = mock(
                ChatProductImageFingerprintService.class);
        ChatImageService service = new ChatImageService(
                imageRepo, conversationRepo, assistantSettings, storageService,
                quotaService, analysisClient, catalog, fingerprints);

        ChatConversationEntity conversation = new ChatConversationEntity();
        conversation.setId(UUID.randomUUID());
        conversation.setCustomerId(UUID.randomUUID());
        conversation.setLocale(lang);
        conversation.setExpiresAt(Instant.now().plusSeconds(3600));
        UUID messageId = UUID.randomUUID();
        ChatImageEntity image = new ChatImageEntity();
        image.setId(UUID.randomUUID());
        image.setRequestId(UUID.randomUUID());
        image.setConversationId(conversation.getId());
        image.setStorageBucket("private");
        image.setStorageObjectKey("chat/object.jpg");
        image.setMimeType("image/jpeg");
        image.setWidth(800);
        image.setHeight(600);
        image.setSizeBytes(1024);
        image.setSha256("a".repeat(64));
        image.setStatus("PENDING");
        image.setExpiresAt(conversation.getExpiresAt());

        when(imageRepo.findById(image.getId())).thenReturn(Optional.of(image));
        when(imageRepo.save(any(ChatImageEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(imageRepo.saveAndFlush(any(ChatImageEntity.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(imageRepo.findByCustomerMessageIdInOrderByCreatedAtAsc(any()))
                .thenAnswer(invocation -> image.getCustomerMessageId() == null
                        ? List.of() : List.of(image));
        when(assistantSettings.imageSettings())
                .thenReturn(new ChatAssistantSettings.ImageSettings(true, 20, 3));
        when(quotaService.tryReserve(20)).thenReturn(true);
        when(storageService.read("private", "chat/object.jpg", "image/jpeg"))
                .thenReturn(new ChatImageStorageService.StoredContent(new byte[] {1, 2, 3}, "image/jpeg"));
        when(catalog.listAssistantDecisionProducts(lang)).thenReturn(List.of(product()));
        when(fingerprints.findStrictMatch(any(), anyString(), any()))
                .thenReturn(Optional.empty());

        return new Fixture(
                service, imageRepo, conversationRepo, assistantSettings, storageService,
                quotaService, analysisClient, fingerprints,
                conversation, image, messageId, lang);
    }

    private static Product product() {
        CategorySummary category = new CategorySummary(
                "category-helmet", "mu-bao-hiem", null, "Mũ bảo hiểm", true, false);
        return new Product(
                "product-tanami", "SKU-TANAMI", "mu-tanami", null, "Mũ Tanami",
                null, null,
                new BrandSummary("brand-tanami", "tanami", "Tanami"),
                category, List.of(category), null, List.of(), List.of(),
                new ProductPrice(BigDecimal.valueOf(2_000_000), null, "VND"),
                List.of(), ProductStockState.IN_STOCK, Boolean.TRUE, PublishStatus.PUBLISHED,
                false, null, HomepageBlock.NONE, null, null, null, List.of(), List.of(),
                ProductHighlights.EMPTY, null, null, null, null, null, null, null,
                List.of(), List.of(), List.of(), null, null, null, null, null,
                Instant.now(), Instant.now());
    }

    private record Fixture(
            ChatImageService service,
            ChatImageJpaRepository imageRepo,
            ChatConversationJpaRepository conversationRepo,
            ChatAssistantSettings assistantSettings,
            ChatImageStorageService storageService,
            ChatImageDailyQuotaService quotaService,
            ChatImageAnalysisClient analysisClient,
            ChatProductImageFingerprintService fingerprints,
            ChatConversationEntity conversation,
            ChatImageEntity image,
            UUID messageId,
            String lang
    ) {
        void visualMatch(String slug) {
            when(fingerprints.findStrictMatch(any(), anyString(), any())).thenReturn(Optional.of(
                    new ChatProductImageFingerprintService.VisualMatch(
                            "product-tanami", slug, BigDecimal.ONE, "CONTENT_SHA256")));
        }

        void analysis(ChatImageAnalysisClient.ImageAnalysis analysis) {
            when(analysisClient.analyze(
                    any(), anyString(), anyString(), any(), any()))
                    .thenReturn(new ChatImageAnalysisClient.AnalysisCall(
                            Optional.of(analysis), 1, null));
        }

        ChatImageService.ImageTurnResult process(String caption) {
            return service.processTurn(
                    conversation, messageId, List.of(image.getId()), caption, lang);
        }
    }
}
