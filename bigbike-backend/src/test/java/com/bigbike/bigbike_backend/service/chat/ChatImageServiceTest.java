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
                        .contains("trông giống Mũ Tanami")
                        .contains("mở mẫu bên dưới")
                        .doesNotContain("đây chính là");
            } else {
                assertThat(result.answer())
                        .contains("looks similar to Mũ Tanami")
                        .contains("compare the details")
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
                    ? "chưa nhận ra món" : "haven’t identified the item yet");
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
                    ? "chưa xác định được mẫu cụ thể"
                    : "haven’t identified the exact model");
        }
    }

    @Test
    void damageReportedInWordsOverridesModelAndNeverDecidesWarranty() {
        assertHighRiskCopy(
                "vi", "PRODUCT_SEARCH", "Mũ này bị nứt, có chắc chắn được bảo hành không?",
                "Shop cần kiểm tra", "trước khi xác nhận bảo hành");
        assertHighRiskCopy(
                "en", "PRODUCT_SEARCH", "This helmet is broken. Is warranty guaranteed?",
                "shop needs to check", "before deciding on warranty cover");
    }

    @Test
    void headOrPersonPhotoNeverGuessesSizeInEitherLanguage() {
        assertHighRiskCopy(
                "vi", "SIZE_FROM_PERSON", "Nhìn đầu tôi thì size nào vừa?",
                "Ảnh chưa cho biết size", "dùng thước dây");
        assertHighRiskCopy(
                "en", "SIZE_FROM_PERSON", "What size fits me from this head photo?",
                "A photo cannot tell me", "with a tape");
    }

    /**
     * Owner decision 2026-09-07. Measured on the live shop 2026-09-07: each of these captions over
     * a plain product photo dropped the customer into an unrelated refusal and took the product
     * card and its buy button away with it.
     */
    @Test
    void wordsAloneNeverRedirectAProductPhotoToOrderLookupOrHeadMeasuring() {
        for (String caption : List.of(
                "Em muốn đặt đơn hàng mẫu này ạ",
                "Mũ này có size nào ạ?",
                "Mũ này bảo hành bao lâu ạ?",
                "Shop có giao hàng về Đà Nẵng không ạ?")) {
            Fixture fixture = fixture("vi");
            fixture.visualMatch("mu-tanami");
            fixture.analysis(new ChatImageAnalysisClient.ImageAnalysis(
                    "PRODUCT_SEARCH", "Mũ bảo hiểm", "HIGH", List.of("mu-tanami"), false));

            ChatImageService.ImageTurnResult result = fixture.process(caption);

            assertThat(result.products()).extracting(item -> item.slug())
                    .as("caption: %s", caption)
                    .containsExactly("mu-tanami");
            assertThat(result.answer()).as("caption: %s", caption)
                    .contains("trông giống Mũ Tanami")
                    .doesNotContain("Lịch sử đơn hàng", "Ảnh chưa cho biết size");
            assertThat(result.continuesToText()).as("caption: %s", caption).isTrue();
        }
    }

    @Test
    void receiptAndPersonPhotosStillStopTheTurnWhateverTheCustomerTyped() {
        Fixture order = fixture("vi");
        order.analysis(new ChatImageAnalysisClient.ImageAnalysis(
                "ORDER_DOCUMENT", "UNKNOWN", "HIGH", List.of(), false));
        ChatImageService.ImageTurnResult orderResult = order.process("Mẫu này giá bao nhiêu?");
        assertThat(orderResult.answer()).contains("Lịch sử đơn hàng");
        assertThat(orderResult.continuesToText()).isFalse();

        Fixture person = fixture("vi");
        person.analysis(new ChatImageAnalysisClient.ImageAnalysis(
                "SIZE_FROM_PERSON", "UNKNOWN", "HIGH", List.of(), false));
        ChatImageService.ImageTurnResult personResult = person.process("Mẫu này giá bao nhiêu?");
        assertThat(personResult.answer()).contains("Ảnh chưa cho biết size");
        assertThat(personResult.continuesToText()).isFalse();
    }

    @Test
    void unrecognizedImageAndUsedUpDailyAllowanceStillLetTheTypedQuestionThrough() {
        Fixture unknown = fixture("vi");
        unknown.analysis(new ChatImageAnalysisClient.ImageAnalysis(
                "UNKNOWN", "UNKNOWN", "LOW", List.of(), false));
        assertThat(unknown.process("Mẫu này giá bao nhiêu?").continuesToText()).isTrue();

        Fixture exhausted = fixture("vi");
        when(exhausted.quotaService.reserveImages(any(), anyInt())).thenReturn(new ChatImageDailyQuotaService.Reservation(List.of(), java.time.LocalDate.now()));
        assertThat(exhausted.process("Mẫu này giá bao nhiêu?").continuesToText()).isTrue();
    }

    @Test
    void orderDocumentAndUnrelatedImagesUseBoundedBilingualResponses() {
        for (String lang : List.of("vi", "en")) {
            Fixture order = fixture(lang);
            order.analysis(new ChatImageAnalysisClient.ImageAnalysis(
                    "ORDER_DOCUMENT", "UNKNOWN", "HIGH", List.of(), false));
            assertThat(order.process("Ảnh đơn hàng").answer()).contains("vi".equals(lang)
                    ? "chưa thể xác minh đơn chỉ từ ảnh"
                    : "verify an order from this image alone");

            Fixture unrelated = fixture(lang);
            unrelated.analysis(new ChatImageAnalysisClient.ImageAnalysis(
                    "UNRELATED", "UNKNOWN", "HIGH", List.of(), false));
            ChatImageService.ImageTurnResult refusal = unrelated.process("Xem ảnh này giúp tôi");
            assertThat(refusal.resultKind()).isEqualTo("REFUSAL");
            assertThat(refusal.answer()).contains("vi".equals(lang)
                    ? "giúp chọn đồ bảo hộ" : "help you choose motorcycle gear");
        }
    }

    @Test
    void dailyImageLimitLeavesTextChatAvailableAndDoesNotCallProvider() {
        for (String lang : List.of("vi", "en")) {
            Fixture fixture = fixture(lang);
            when(fixture.quotaService.reserveImages(any(), anyInt())).thenReturn(new ChatImageDailyQuotaService.Reservation(List.of(), java.time.LocalDate.now()));

            ChatImageService.ImageTurnResult result = fixture.process("Mẫu này còn không?");

            assertThat(result.analyzed()).isFalse();
            assertThat(result.answer()).contains("vi".equals(lang)
                    ? "mô tả món cần tìm để em hỗ trợ tiếp"
                    : "describe the item and I’ll help you find it");
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
        verify(fixture.quotaService).reserveImages(any(), org.mockito.ArgumentMatchers.eq(20));
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
            String lang, String detectedIntent, String caption,
            String expectedOne, String expectedTwo) {
        Fixture fixture = fixture(lang);
        fixture.analysis(new ChatImageAnalysisClient.ImageAnalysis(
                detectedIntent, "Mũ bảo hiểm", "HIGH", List.of("mu-tanami"), false));

        ChatImageService.ImageTurnResult result = fixture.process(caption);

        assertThat(result.answer()).contains(expectedOne, expectedTwo);
        assertThat(result.products()).isEmpty();
        assertThat(result.continuesToText()).isFalse();
        if (caption.toLowerCase().contains("nứt") || caption.toLowerCase().contains("broken")) {
            assertThat(result.answer()).doesNotContain(
                    "chắc chắn được bảo hành", "warranty is guaranteed");
        }
    }

    @Test
    void logoUsesAllProductsOfTheObservedBrandWithoutVisualProductMatches() {
        for (String lang : List.of("vi", "en")) {
            var caberg = new BrandSummary("brand-caberg", "caberg", "Caberg");
            List<Product> products = new java.util.ArrayList<>();
            var slugs = List.of("avalon-x", "drift-evo-ii-carbon", "tanami-carbon");
            var prices = List.of(3_390_000L, 11_500_000L, 12_000_000L);
            for (int i = 0; i < slugs.size(); i++) {
                Product item = org.mockito.Mockito.spy(helmet(slugs.get(i), prices.get(i), HomepageBlock.NONE, null));
                org.mockito.Mockito.doReturn(caberg).when(item).brand();
                products.add(item);
            }
            products.add(product());
            Fixture fixture = fixture(lang, products);
            fixture.analysis(new ChatImageAnalysisClient.ImageAnalysis("PRODUCT_SEARCH", "Mũ bảo hiểm", "HIGH",
                    List.of("mu-tanami"), false, "Caberg", "PRODUCT", "HIGH"));
            var result = fixture.process("Tìm các sản phẩm của thương hiệu này cho tôi");
            assertThat(result.products()).extracting(item -> item.slug())
                    .containsExactlyInAnyOrder("avalon-x", "drift-evo-ii-carbon", "tanami-carbon");
            assertThat(result.products()).extracting(item -> item.retailPrice())
                    .containsExactly(BigDecimal.valueOf(3_390_000), BigDecimal.valueOf(11_500_000), BigDecimal.valueOf(12_000_000));
            assertThat(result.evidence().brand()).isEqualTo("caberg");
            assertThat(result.evidence().matchedSlugs()).isEmpty();
        }
    }

    @Test
    void unknownBrandDoesNotBecomeAnotherBrandsBestsellers() {
        Fixture fixture = fixture("vi");
        fixture.analysis(new ChatImageAnalysisClient.ImageAnalysis("PRODUCT_SEARCH", "Mũ bảo hiểm", "HIGH",
                List.of(), false, "Arai", "PRODUCT", "HIGH"));
        var result = fixture.process("Hãng này có hàng không?");
        assertThat(result.products()).isEmpty();
        assertThat(result.answer()).contains("Arai", "chưa kinh doanh");
    }

    @Test
    void threeImagesAreAttachedInOrderAndOnlyRemainingAllowanceIsRead() {
        Fixture fixture = fixture("vi");
        List<ChatImageEntity> images = new java.util.ArrayList<>(List.of(fixture.image));
        for (int i = 0; i < 2; i++) {
            ChatImageEntity item = new ChatImageEntity();
            org.springframework.beans.BeanUtils.copyProperties(fixture.image, item);
            item.setId(UUID.randomUUID());
            images.add(item);
            when(fixture.imageRepo.findById(item.getId())).thenReturn(Optional.of(item));
        }
        when(fixture.quotaService.reserveImages(any(), anyInt())).thenReturn(
                new ChatImageDailyQuotaService.Reservation(List.of(images.get(0).getId()), java.time.LocalDate.now()));
        fixture.analysis(new ChatImageAnalysisClient.ImageAnalysis("PRODUCT_SEARCH", "Mũ bảo hiểm", "HIGH", List.of(), false));
        var result = fixture.service.processTurn(fixture.conversation, fixture.messageId,
                images.stream().map(ChatImageEntity::getId).toList(), "Có hàng không?", "vi");
        assertThat(images).extracting(ChatImageEntity::getAttachmentPosition).containsExactly(0, 1, 2);
        assertThat(images).extracting(ChatImageEntity::getStatus).containsExactly("READY", "LIMIT_SKIPPED", "LIMIT_SKIPPED");
        assertThat(result.answer()).contains("1/3 ảnh", "chưa được đọc");
        verify(fixture.analysisClient, never()).analyzeBatch(any(), any(), any(), any());
    }

    @Test
    void receiptIsAcknowledgedOnlyAfterTheInternalNotificationIsPersisted() {
        Fixture fixture = fixture("vi");
        ChatReceiptNotificationService notifications = mock(ChatReceiptNotificationService.class);
        org.springframework.test.util.ReflectionTestUtils.setField(fixture.service, "receiptNotifications", notifications);
        fixture.analysis(new ChatImageAnalysisClient.ImageAnalysis("BANK_TRANSFER_RECEIPT", "UNKNOWN", "HIGH", List.of(),
                false, "Test Receiver", "UNKNOWN", "LOW"));
        var result = fixture.process("Tôi đã chuyển khoản");
        assertThat(fixture.image.getAnalysisJson()).doesNotContain("Test Receiver");
        verify(notifications).receive(fixture.conversation.getId(), fixture.messageId);
        assertThat(result.answer()).contains("đã chuyển ảnh biên lai", "sau khi đối chiếu");
        assertThat(result.continuesToText()).isFalse();
        assertThat(result.products()).isEmpty();
    }

    @Test
    void lowConfidenceGroupAndShopWatermarkAreNotProductEvidence() {
        Fixture fixture = fixture("vi");
        fixture.analysis(new ChatImageAnalysisClient.ImageAnalysis("PRODUCT_SEARCH", "Mũ bảo hiểm", "LOW",
                List.of("mu-tanami"), false, "BigBike", "STORE", "HIGH"));
        var result = fixture.process("Có sản phẩm này không?");
        assertThat(result.products()).isEmpty();
        assertThat(result.evidence().hasScope()).isFalse();
        assertThat(result.answer()).doesNotContain("Đây là", "hãng này");
    }

    @Test
    void conflictingBrandsAskForAnImageInsteadOfMixingCards() {
        Fixture fixture = fixture("vi");
        ChatImageEntity second = new ChatImageEntity();
        org.springframework.beans.BeanUtils.copyProperties(fixture.image, second);
        second.setId(UUID.randomUUID());
        when(fixture.imageRepo.findById(second.getId())).thenReturn(Optional.of(second));
        List<UUID> ids = List.of(fixture.image.getId(), second.getId());
        when(fixture.quotaService.reserveImages(any(), anyInt())).thenReturn(
                new ChatImageDailyQuotaService.Reservation(ids, java.time.LocalDate.now()));
        when(fixture.analysisClient.analyzeBatch(any(), any(), any(), any())).thenReturn(
                new ChatImageAnalysisClient.BatchAnalysisCall(Optional.of(List.of(
                        new ChatImageAnalysisClient.ImageAnalysis("PRODUCT_SEARCH", "UNKNOWN", "LOW", List.of(), false, "Caberg", "PRODUCT", "HIGH"),
                        new ChatImageAnalysisClient.ImageAnalysis("PRODUCT_SEARCH", "UNKNOWN", "LOW", List.of(), false, "Arai", "PRODUCT", "HIGH"))), 1, null));
        var result = fixture.service.processTurn(fixture.conversation, fixture.messageId, ids, "Có hàng không?", "vi");
        assertThat(result.products()).isEmpty();
        assertThat(result.evidence().ambiguous()).isTrue();
        assertThat(result.evidence().clarification("vi").criterion()).isEqualTo("IMAGE");
        assertThat(result.continuesToText()).isFalse();
        assertThat(result.answer()).contains("ảnh nào");
    }

    @Test
    void aReceiptNotificationFailureIsNeverPresentedAsSuccessfulForwarding() {
        Fixture fixture = fixture("en");
        ChatReceiptNotificationService notifications = mock(ChatReceiptNotificationService.class);
        org.springframework.test.util.ReflectionTestUtils.setField(fixture.service, "receiptNotifications", notifications);
        org.mockito.Mockito.doThrow(new IllegalStateException("test failure")).when(notifications).receive(any(), any());
        fixture.analysis(new ChatImageAnalysisClient.ImageAnalysis("BANK_TRANSFER_RECEIPT", "UNKNOWN", "HIGH", List.of(), false));
        var result = fixture.process("Transfer screenshot");
        assertThat(result.answer()).contains("couldn’t notify").doesNotContain("I’ve sent", "payment received");
        assertThat(result.continuesToText()).isFalse();
    }

    @Test
    void cachedBatchAnalysisReplaysWithoutCallingTheProviderAgain() {
        Fixture fixture = fixture("vi");
        fixture.analysis(new ChatImageAnalysisClient.ImageAnalysis("PRODUCT_SEARCH", "Mũ bảo hiểm", "HIGH", List.of(), false));
        var first = fixture.process("Có sản phẩm này không?");
        Instant deadline = fixture.image.getAnalysisDeadlineAt();
        var second = fixture.process("Có sản phẩm này không?");
        assertThat(second.products()).isEqualTo(first.products());
        assertThat(fixture.image.getAnalysisDeadlineAt()).isEqualTo(deadline);
        verify(fixture.analysisClient).analyze(any(), anyString(), anyString(), any(), any());
    }

    @Test
    void aTemporaryPrivateStorageReadFailureRetriesBeforeReturningProductAdvice() {
        Fixture fixture = fixture("vi");
        when(fixture.storageService.read("private", "chat/object.jpg", "image/jpeg"))
                .thenThrow(new IllegalStateException("temporary read failure"))
                .thenReturn(new ChatImageStorageService.StoredContent(new byte[]{1, 2, 3}, "image/jpeg"));
        fixture.analysis(new ChatImageAnalysisClient.ImageAnalysis("PRODUCT_SEARCH", "Mũ bảo hiểm", "HIGH", List.of(), false));
        var result = fixture.process("Có hàng không?");
        assertThat(result.products()).isNotEmpty();
        verify(fixture.storageService, org.mockito.Mockito.times(2)).read("private", "chat/object.jpg", "image/jpeg");
        verify(fixture.quotaService).reserveImages(any(), anyInt());
    }

    @Test
    void anUnclearProductCanStillUseVerifiedLocalVisualEvidence() {
        Fixture fixture = fixture("vi");
        fixture.visualMatch("mu-tanami");
        fixture.analysis(new ChatImageAnalysisClient.ImageAnalysis("UNKNOWN", "UNKNOWN", "LOW", List.of(), false));
        var result = fixture.process("Có mẫu này không?");
        assertThat(result.products()).extracting(item -> item.slug()).containsExactly("mu-tanami");
        assertThat(result.answer()).contains("trông giống");
        assertThat(result.evidence().group()).isEqualTo("mu-bao-hiem");
    }

    private static Fixture fixture(String lang) {
        return fixture(lang, List.of(product()));
    }

    private static Fixture fixture(String lang, List<Product> catalogProducts) {
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
                .thenReturn(new ChatAssistantSettings.ImageSettings(true, 60, 9));
        when(quotaService.reserveImages(any(), anyInt())).thenAnswer(call -> new ChatImageDailyQuotaService.Reservation(call.getArgument(0), java.time.LocalDate.now()));
        when(storageService.read("private", "chat/object.jpg", "image/jpeg"))
                .thenReturn(new ChatImageStorageService.StoredContent(new byte[] {1, 2, 3}, "image/jpeg"));
        when(catalog.listAssistantDecisionProducts(lang)).thenReturn(catalogProducts);
        when(fingerprints.compare(any(), anyString(), any()))
                .thenReturn(ChatProductImageFingerprintService.VisualComparison.empty());

        return new Fixture(
                service, imageRepo, conversationRepo, assistantSettings, storageService,
                quotaService, analysisClient, fingerprints,
                conversation, image, messageId, lang);
    }

    /**
     * Owner decision 2026-09-07. Measured 2026-09-07: three different full-face helmet photos came
     * back with the identical three models, because the group list was simply the first three
     * products of the category in slug order.
     */
    @Test
    void groupSuggestionsFollowThePhotoFirstAndTheShopsOwnPriorityAfterwards() {
        Fixture fixture = fixture("vi", helmetGroup());
        fixture.visualRanking("mu-omega", "mu-gamma");
        fixture.analysis(new ChatImageAnalysisClient.ImageAnalysis(
                "PRODUCT_SEARCH", "Mũ bảo hiểm", "MEDIUM", List.of(), false));

        ChatImageService.ImageTurnResult result = fixture.process("Đây là loại gì?");

        assertThat(result.products()).extracting(item -> item.slug())
                .startsWith("mu-omega", "mu-gamma")
                .hasSize(3)
                .doesNotHaveDuplicates();
    }

    @Test
    void withNothingToCompareTheShopsPinnedModelLeadsInsteadOfTheAlphabeticalFirst() {
        Fixture fixture = fixture("vi", helmetGroup());
        fixture.visualRanking();
        fixture.analysis(new ChatImageAnalysisClient.ImageAnalysis(
                "PRODUCT_SEARCH", "Mũ bảo hiểm", "MEDIUM", List.of(), false));

        ChatImageService.ImageTurnResult result = fixture.process("Đây là loại gì?");

        assertThat(result.products()).extracting(item -> item.slug())
                .first().isEqualTo("mu-omega");
    }

    /** Alphabetically the group runs alpha, beta, gamma, omega; "mu-omega" is the pinned model. */
    private static List<Product> helmetGroup() {
        return List.of(
                helmet("mu-alpha", 1_000_000, HomepageBlock.NONE, null),
                helmet("mu-beta", 2_000_000, HomepageBlock.NONE, null),
                helmet("mu-gamma", 3_000_000, HomepageBlock.NONE, null),
                helmet("mu-omega", 12_000_000, HomepageBlock.FEATURED_GRID, 1));
    }

    private static Product helmet(
            String slug, long price, HomepageBlock block, Integer homepageOrder) {
        CategorySummary category = new CategorySummary(
                "category-helmet", "mu-bao-hiem", null, "Mũ bảo hiểm", true, false);
        return new Product(
                "product-" + slug, "SKU-" + slug, slug, null, "Mũ " + slug,
                null, null,
                new BrandSummary("brand-tanami", "tanami", "Tanami"),
                category, List.of(category), null, List.of(), List.of(),
                new ProductPrice(BigDecimal.valueOf(price), null, "VND"),
                List.of(), ProductStockState.IN_STOCK, Boolean.TRUE, PublishStatus.PUBLISHED,
                false, null, block, homepageOrder, null, null, List.of(), List.of(),
                ProductHighlights.EMPTY, null, null, null, null, null, null, null,
                List.of(), List.of(), List.of(), null, null, null, null, null,
                Instant.now(), Instant.now());
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
            when(fingerprints.compare(any(), anyString(), any())).thenReturn(
                    new ChatProductImageFingerprintService.VisualComparison(
                            Optional.of(new ChatProductImageFingerprintService.VisualMatch(
                                    "product-tanami", slug, BigDecimal.ONE, "CONTENT_SHA256")),
                            List.of(slug)));
        }

        /** No product clears the evidence bar, but the photo still ranks the group's models. */
        void visualRanking(String... slugs) {
            when(fingerprints.compare(any(), anyString(), any())).thenReturn(
                    new ChatProductImageFingerprintService.VisualComparison(
                            Optional.empty(), List.of(slugs)));
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
