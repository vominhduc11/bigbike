package com.bigbike.bigbike_backend.service.chat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.atLeast;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.core.read.ListAppender;
import com.bigbike.bigbike_backend.api.chat.dto.ChatContactResponse;
import com.bigbike.bigbike_backend.api.chat.dto.ChatHandoffStatusResponse;
import com.bigbike.bigbike_backend.api.chat.dto.ChatMessageRequest;
import com.bigbike.bigbike_backend.api.chat.dto.ChatMessageResponse;
import com.bigbike.bigbike_backend.api.chat.dto.ChatPageContextRequest;
import com.bigbike.bigbike_backend.api.chat.dto.ChatProductCardResponse;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatConversationEntity;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatMessageEntity;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatConversationJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatLeadJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatMessageJpaRepository;
import com.bigbike.bigbike_backend.service.ws.AdminChatWsService;
import java.time.Instant;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.slf4j.LoggerFactory;

class ChatServiceFallbackTest {

    private static final UUID CONVERSATION_ID = UUID.fromString(
            "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
    private static final ChatContactResponse CONTACTS = new ChatContactResponse(
            "0900000000", "https://zalo.me/shop", "https://m.me/shop", "Shop", "Shop");

    @Test
    @DisplayName("AC5: an active staff claim stores the customer message without invoking the assistant")
    void activeStaffClaimStopsAutomaticAssistantReplies() {
        Fixture fixture = fixture(true, 60, 0);
        UUID handoffId = UUID.randomUUID();
        when(fixture.handoffService.liveForConversation(CONVERSATION_ID)).thenReturn(
                new ChatHandoffStatusResponse(
                        handoffId, "ACTIVE", Instant.now(), "STAFF_ACTIVE", "Minh",
                        true, null, "Thứ Hai–Thứ Sáu 09:00–21:00"));

        ChatMessageResponse response = fixture.service.send(request("Size M còn hàng không?"), null);

        assertThat(response.channelState()).isEqualTo("STAFF_ACTIVE");
        assertThat(response.handoff().id()).isEqualTo(handoffId);
        assertThat(response.countedTurns()).isZero();
        verify(fixture.handoffService).customerMessageAdded(CONVERSATION_ID);
        verify(fixture.aiClient, never()).answer(
                anyString(), anyString(), any(ChatToolRegistry.class), anyBoolean(),
                any(AiChatClient.ToolExecutor.class),
                any(ChatToolService.AssistantCatalogVocabulary.class), any(), any());
        verify(fixture.toolService, never()).resolveFastPath(
                anyString(), anyString(), any(), any(), any());
        verify(fixture.messageRepo).save(argThat(message ->
                "CUSTOMER".equals(message.getRole())));
    }

    @Test
    @DisplayName("three deterministic clarification turns reserve no AI quota and call no provider")
    void multiRoundClarificationIsFreeOfProviderCalls() {
        Fixture fixture = fixture(true, 60, 0);
        ChatToolService.ProductDecisionContext groupState = new ChatToolService.ProductDecisionContext(
                null, null, null, null, null, List.of("GROUP"),
                new ChatToolService.PendingClarification(
                        UUID.randomUUID(), "GROUP", List.of(
                        new ChatToolService.PendingClarificationOption(
                                "group-helmet", "Mũ bảo hiểm", "FILTER", "helmet", 13L),
                        new ChatToolService.PendingClarificationOption(
                                "show-all", "Cứ cho em xem tất cả", "BYPASS", "show-all", null))));
        ChatToolService.ProductDecisionContext useState = new ChatToolService.ProductDecisionContext(
                "helmet", null, null, null, null, List.of("GROUP", "USE_CASE"),
                new ChatToolService.PendingClarification(
                        UUID.randomUUID(), "USE_CASE", List.of(
                        new ChatToolService.PendingClarificationOption(
                                "use-long-tour", "Đi tour đường dài", "FILTER", "long-tour", 5L),
                        new ChatToolService.PendingClarificationOption(
                                "show-all", "Cứ cho em xem tất cả", "BYPASS", "show-all", null))));
        ChatToolService.ProductDecisionContext finalState = new ChatToolService.ProductDecisionContext(
                "helmet", "long-tour", null, null, null,
                List.of("GROUP", "USE_CASE"), null);
        ChatToolService.ToolOutcome first = ChatToolService.ToolOutcome.clarification(
                "Em đã lọc theo mức giá anh/chị nêu. Anh/chị cần nhóm hàng nào ạ?",
                List.of(), new ChatToolService.SearchScope(null, null, null, 5_000_000L), groupState);
        ChatToolService.ToolOutcome second = ChatToolService.ToolOutcome.clarification(
                "Em gửi một lựa chọn còn hàng tiêu biểu; đây chưa phải kết quả cuối. Anh/chị chủ yếu đi phố hay đi tour đường dài ạ?",
                List.of(card()), new ChatToolService.SearchScope("mu-bao-hiem", null, null, 5_000_000L),
                useState);
        ChatToolService.ToolOutcome third = ChatToolService.ToolOutcome.decided(
                "Em đã đủ thông tin và hiển thị lựa chọn còn hàng phù hợp bên dưới.",
                List.of(card()), new ChatToolService.SearchScope("mu-bao-hiem", null, null, 5_000_000L),
                finalState);
        when(fixture.toolService.resolveFastPath(anyString(), eq("vi"), isNull(), any(), any()))
                .thenReturn(Optional.of(first), Optional.of(second), Optional.of(third));

        ChatMessageResponse one = fixture.service.send(request("dưới 5 triệu"), null);
        ChatMessageResponse two = fixture.service.send(request("mũ bảo hiểm"), null);
        ChatMessageResponse three = fixture.service.send(request("đi tour đường dài"), null);

        assertThat(one.clarification()).isNotNull();
        assertThat(two.clarification()).isNotNull();
        assertThat(three.clarification()).isNull();
        assertThat(one.countedTurns()).isZero();
        assertThat(two.countedTurns()).isZero();
        assertThat(three.countedTurns()).isEqualTo(1);
        assertThat(one.turnsRemaining()).isEqualTo(ChatService.MAX_TURNS);
        assertThat(two.turnsRemaining()).isEqualTo(ChatService.MAX_TURNS);
        assertThat(three.turnsRemaining()).isEqualTo(ChatService.MAX_TURNS - 1);
        verify(fixture.quota, never()).tryReserve(anyInt());
        verify(fixture.aiClient, never()).answer(
                anyString(), anyString(), any(ChatToolRegistry.class), anyBoolean(),
                any(AiChatClient.ToolExecutor.class),
                any(ChatToolService.AssistantCatalogVocabulary.class), any(), any());
        ArgumentCaptor<ChatMessageEntity> messages = ArgumentCaptor.forClass(ChatMessageEntity.class);
        verify(fixture.messageRepo, atLeast(3)).save(messages.capture());
        assertThat(messages.getAllValues().stream()
                .filter(message -> "ASSISTANT".equals(message.getRole())))
                .allSatisfy(message -> {
                    assertThat(message.isAiCalled()).isFalse();
                    assertThat(message.getProviderRequestCount()).isZero();
                });
    }

    @Test
    @DisplayName("a fast-path guard rejection keeps the conversation open and refunds the turn")
    void fastPathGuardRejectionIsRecoverable() {
        Fixture fixture = fixture(true, 60, 0);
        when(fixture.toolService.resolveFastPath(anyString(), eq("vi"), isNull(), any(), any()))
                .thenReturn(Optional.of(ChatToolService.ToolOutcome.local(
                        "Dạ, <strong>em đã kiểm tra thông tin này.</strong>", "TEMPLATE", false, false, false)))
                .thenReturn(Optional.of(ChatToolService.ToolOutcome.local(
                        "Dạ, em có thể hỗ trợ tìm sản phẩm. Anh/chị cho em biết nhu cầu cần xem nhé?",
                        "TEMPLATE", false, false, false)));

        ChatMessageResponse fallback = fixture.service.send(request("Câu hỏi bị chặn"), null);

        assertRecoverable(fallback, fixture.conversation);
        ChatMessageResponse next = fixture.service.send(request("Câu hỏi tiếp theo"), null);
        assertThat(next.mode()).isEqualTo("AI");
        assertThat(next.turnCount()).isEqualTo(1);
        assertThat(next.answer()).contains("có thể hỗ trợ");
        assertThat(fixture.conversation.getEndedReason()).isNull();
    }

    @Test
    @DisplayName("a model tone rejection with verified cards is recovered locally without another provider call")
    void modelToneRejectionUsesLocalCardRecovery() {
        Fixture fixture = fixture(true, 60, 0);
        when(fixture.toolService.resolveFastPath(anyString(), eq("vi"), isNull(), any(), any()))
                .thenReturn(Optional.empty());
        when(fixture.aiClient.answer(
                anyString(), eq("vi"), any(ChatToolRegistry.class), eq(true),
                any(AiChatClient.ToolExecutor.class),
                any(ChatToolService.AssistantCatalogVocabulary.class), any(), any()))
                .thenReturn(Optional.of(hybrid(
                        "Chào em, em đang tìm sản phẩm nào? Anh/chị nói rõ để trợ lý hỗ trợ.",
                        List.of(card()))));

        ChatMessageResponse response = fixture.service.send(request("Câu hỏi bị guard chặn"), null);

        assertThat(response.mode()).isEqualTo("AI");
        assertThat(response.turnCount()).isEqualTo(1);
        assertThat(response.answer()).contains("hiển thị 1 sản phẩm").doesNotContain("Chào em");
        assertThat(response.products()).extracting(ChatProductCardResponse::slug).containsExactly("safe-card");
        assertThat(fixture.conversation.getEndedReason()).isNull();
        assertThat(fixture.conversation.getAiCallCount()).isEqualTo(1);
        ArgumentCaptor<ChatMessageEntity> savedMessages = ArgumentCaptor.forClass(ChatMessageEntity.class);
        verify(fixture.messageRepo, atLeast(2)).save(savedMessages.capture());
        assertThat(savedMessages.getAllValues()).filteredOn(message -> "ASSISTANT".equals(message.getRole()))
                .extracting(ChatMessageEntity::getAiRetryCount)
                .containsExactly(0);
    }

    @Test
    @DisplayName("one unsafe product is removed while verified sellable products remain")
    void unsafeProductIsFilteredWithoutDiscardingSafeCards() {
        Fixture fixture = fixture(true, 60, 0);
        when(fixture.toolService.resolveFastPath(anyString(), eq("vi"), isNull(), any(), any()))
                .thenReturn(Optional.empty());
        ChatProductCardResponse unavailable = new ChatProductCardResponse(
                "sold-out-card", "Sản phẩm đã hết hàng", null,
                BigDecimal.valueOf(2_000_000), null, "VND", "OUT_OF_STOCK");
        when(fixture.aiClient.answer(
                anyString(), eq("vi"), any(ChatToolRegistry.class), eq(true),
                any(AiChatClient.ToolExecutor.class),
                any(ChatToolService.AssistantCatalogVocabulary.class), any(), any()))
                .thenReturn(Optional.of(hybrid(
                        "Dạ, em đã tìm được các sản phẩm phù hợp. "
                                + "Anh/chị xem các thẻ bên dưới để chọn mẫu cần kiểm tra nhé.",
                        List.of(card(), unavailable))));

        ChatMessageResponse response = fixture.service.send(request("Tìm sản phẩm đang bán"), null);

        assertThat(response.mode()).isEqualTo("AI");
        assertThat(response.products()).extracting(ChatProductCardResponse::slug)
                .containsExactly("safe-card");
        assertThat(response.resultKind()).isEqualTo("PRODUCT_RESULTS");
        assertThat(response.answer())
                .contains("hiển thị 1 sản phẩm")
                .doesNotContain("Sản phẩm đã hết hàng", "sold-out-card");
        assertThat(fixture.conversation.getTurnCount()).isEqualTo(1);

        ArgumentCaptor<ChatMessageEntity> savedMessages = ArgumentCaptor.forClass(ChatMessageEntity.class);
        verify(fixture.messageRepo, atLeast(2)).save(savedMessages.capture());
        assertThat(savedMessages.getAllValues())
                .filteredOn(message -> "ASSISTANT".equals(message.getRole()))
                .extracting(ChatMessageEntity::getResultKind)
                .containsExactly("PRODUCT_RESULTS");
    }

    @Test
    @DisplayName("fixed fallback logs include a reason code but exclude customer content and phone")
    void fallbackLogContainsNoCustomerPersonalData() {
        Fixture fixture = fixture(true, 60, 0);
        when(fixture.toolService.resolveFastPath(anyString(), eq("vi"), isNull(), any(), any()))
                .thenThrow(new RuntimeException("lookup failed"));
        Logger logger = (Logger) LoggerFactory.getLogger(ChatService.class);
        ListAppender<ch.qos.logback.classic.spi.ILoggingEvent> appender = new ListAppender<>();
        appender.start();
        logger.addAppender(appender);

        try {
            fixture.service.send(request(
                    "Tôi là Nguyễn Bí Mật, số điện thoại 0909 123 456, cần tìm mũ"), null);
        } finally {
            logger.detachAppender(appender);
            appender.stop();
        }

        String logs = appender.list.stream()
                .map(ch.qos.logback.classic.spi.ILoggingEvent::getFormattedMessage)
                .collect(java.util.stream.Collectors.joining("\n"));
        assertThat(logs)
                .contains("reason=FAST_PATH_EXCEPTION", "flow=FAST_PATH")
                .doesNotContain("Nguyễn Bí Mật", "0909", "123 456", "cần tìm mũ");
    }

    @Test
    @DisplayName("an unsafe one-sided price count is rebuilt from verified search totals before fallback")
    void verifiedPriceRangeRecoveryWinsBeforeContactFallback() {
        Fixture fixture = fixture(true, 60, 0);
        when(fixture.toolService.resolveFastPath(anyString(), eq("vi"), isNull(), any(), any()))
                .thenReturn(Optional.empty());
        when(fixture.aiClient.answer(
                anyString(), eq("vi"), any(ChatToolRegistry.class), eq(true),
                any(AiChatClient.ToolExecutor.class),
                any(ChatToolService.AssistantCatalogVocabulary.class), any(), any()))
                .thenReturn(Optional.of(hybridWithVerifiedRangeTotals()));

        ChatMessageResponse response = fixture.service.send(request("Tai nghe trên 3tr có bao nhiêu mẫu?"), null);

        assertThat(response.mode()).isEqualTo("AI");
        assertThat(response.answer())
                .contains("hiển thị 3 sản phẩm phù hợp bên dưới")
                .doesNotContain("Gặp nhân viên");
        assertThat(response.products()).hasSize(3);
    }

    @Test
    @DisplayName("a polite Vietnamese answer without both pronoun keywords is accepted")
    void politeAnswerWithoutMandatoryPronounsDoesNotFallBack() {
        Fixture fixture = fixture(true, 60, 0);
        when(fixture.toolService.resolveFastPath(anyString(), eq("vi"), isNull(), any(), any()))
                .thenReturn(Optional.empty());
        when(fixture.aiClient.answer(
                anyString(), eq("vi"), any(ChatToolRegistry.class), eq(true),
                any(AiChatClient.ToolExecutor.class),
                any(ChatToolService.AssistantCatalogVocabulary.class), any(), any()))
                .thenReturn(Optional.of(hybrid(
                        "Dạ, shop hiện có dữ liệu phù hợp. Mời anh/chị xem các sản phẩm bên dưới để chọn mẫu cần kiểm tra.")));

        ChatMessageResponse response = fixture.service.send(request("Câu hỏi lịch sự"), null);

        assertThat(response.mode()).isEqualTo("AI");
        assertThat(response.answer()).contains("shop hiện có");
        assertThat(fixture.conversation.getAiCallCount()).isEqualTo(1);
    }

    @Test
    @DisplayName("a repeated recoverable fallback changes its customer wording")
    void repeatedFallbackDoesNotRepeatTheSameText() {
        Fixture fixture = fixture(true, 60, 0);
        when(fixture.toolService.resolveFastPath(anyString(), eq("vi"), isNull(), any(), any()))
                .thenReturn(Optional.empty());
        when(fixture.aiClient.answer(
                anyString(), eq("vi"), any(ChatToolRegistry.class), eq(true),
                any(AiChatClient.ToolExecutor.class),
                any(ChatToolService.AssistantCatalogVocabulary.class), any(), any()))
                .thenReturn(Optional.of(hybrid(
                        "Chào em, em đang tìm sản phẩm nào? Anh/chị nói rõ để trợ lý hỗ trợ.")));
        ChatMessageEntity priorFallback = new ChatMessageEntity();
        priorFallback.setSource("CONTACT_FALLBACK");
        when(fixture.messageRepo.findFirstByConversationIdAndRoleOrderByCreatedAtDesc(
                CONVERSATION_ID, "ASSISTANT"))
                .thenReturn(Optional.empty(), Optional.empty(), Optional.of(priorFallback));

        ChatMessageResponse first = fixture.service.send(request("Câu hỏi bị chặn lần một"), null);
        ChatMessageResponse second = fixture.service.send(request("Câu hỏi bị chặn lần hai"), null);

        assertRecoverable(first, fixture.conversation);
        assertRecoverable(second, fixture.conversation);
        assertThat(second.answer())
                .isNotEqualTo(first.answer())
                .contains("đang bận", "Gặp nhân viên")
                .doesNotContain("kết quả đã xác minh", "nội dung trả lời an toàn", "shop hiện chưa có");
    }

    @Test
    @DisplayName("a newly verified count is not mistaken for a duplicate reply")
    void changedVerifiedCatalogCountIsNotReplacedByDuplicateClarification() {
        Fixture fixture = fixture(true, 60, 0);
        when(fixture.toolService.resolveFastPath(anyString(), eq("vi"), isNull(), any(), any()))
                .thenReturn(Optional.empty());
        when(fixture.aiClient.answer(
                anyString(), eq("vi"), any(ChatToolRegistry.class), eq(true),
                any(AiChatClient.ToolExecutor.class),
                any(ChatToolService.AssistantCatalogVocabulary.class), any(), any()))
                .thenReturn(Optional.of(hybridWithVerifiedTotals(12)), Optional.of(hybridWithVerifiedTotals(8)));
        ChatMessageEntity previous = new ChatMessageEntity();
        previous.setContent("Dạ, trong tầm giá anh/chị hỏi, shop có 12 mẫu tai nghe. "
                + "Em đang hiển thị 3 sản phẩm tiêu biểu bên dưới trong tổng 12 mẫu phù hợp.");
        when(fixture.messageRepo.findFirstByConversationIdAndRoleOrderByCreatedAtDesc(
                CONVERSATION_ID, "ASSISTANT"))
                .thenReturn(Optional.empty(), Optional.of(previous));

        fixture.service.send(request("Tôi muốn xem tai nghe"), null);
        ChatMessageResponse second = fixture.service.send(request("Từ 3tr đến 5tr đi"), null);

        assertThat(second.answer()).contains("8 mẫu tai nghe").doesNotContain("để em kiểm tra đúng ý");
    }

    @Test
    @DisplayName("an AI exception keeps the conversation open and allows the next question")
    void providerFailureIsRecoverable() {
        Fixture fixture = fixture(true, 60, 0);
        when(fixture.toolService.resolveFastPath(anyString(), eq("vi"), isNull(), any(), any()))
                .thenReturn(Optional.empty());
        when(fixture.aiClient.answer(
                anyString(), eq("vi"), any(ChatToolRegistry.class), eq(true),
                any(AiChatClient.ToolExecutor.class),
                any(ChatToolService.AssistantCatalogVocabulary.class), any(), any()))
                .thenThrow(new RuntimeException("provider unavailable"))
                .thenReturn(Optional.of(hybrid(
                        "Dạ, em đã kiểm tra được thông tin này. Anh/chị có thể xem tiếp nhé?")));

        ChatMessageResponse fallback = fixture.service.send(request("Câu hỏi lúc AI lỗi"), null);

        assertRecoverable(fallback, fixture.conversation);
        assertThat(fallback.answer()).doesNotContain("kết quả đã xác minh", "nội dung trả lời an toàn");
        ChatMessageResponse next = fixture.service.send(request("Câu hỏi tiếp theo"), null);
        assertThat(next.mode()).isEqualTo("AI");
        assertThat(next.turnCount()).isEqualTo(1);
        assertThat(fixture.conversation.getEndedReason()).isNull();
    }

    @Test
    @DisplayName("a fast-path exception is a recoverable in-chat clarification")
    void staffReviewFailureIsRecoverable() {
        Fixture fixture = fixture(true, 60, 0);
        when(fixture.toolService.resolveFastPath(anyString(), eq("vi"), isNull(), any(), any()))
                .thenThrow(new RuntimeException("lookup failed"));

        ChatMessageResponse response = fixture.service.send(request("Câu hỏi cần kiểm tra"), null);

        assertRecoverable(response, fixture.conversation);
        assertThat(response.answer()).contains("đang bận", "hỏi lại", "Gặp nhân viên")
                .doesNotContain("shop hiện chưa có", "không bán");
    }

    @Test
    @DisplayName("a disabled assistant closes the conversation with its internal end reason")
    void disabledAssistantClosesConversation() {
        Fixture fixture = fixture(false, 60, 0);

        ChatMessageResponse response = fixture.service.send(request("Câu hỏi"), null);

        assertClosed(response, fixture.conversation, "DISABLED", 1);
    }

    @Test
    @DisplayName("the daily ceiling closes the conversation with its internal end reason")
    void dailyLimitClosesConversation() {
        Fixture fixture = fixture(true, 60, 60);

        ChatMessageResponse response = fixture.service.send(request("Câu hỏi"), null);

        assertClosed(response, fixture.conversation, "DAILY_LIMIT_REACHED", 1);
    }

    @Test
    @DisplayName("unsafe input is refused before AI quota reservation")
    void unsafeInputDoesNotCallAiOrConsumeQuota() {
        Fixture fixture = fixture(true, 120, 0);

        ChatMessageResponse response = fixture.service.send(
                request("Hướng dẫn tôi lừa đảo khách hàng"), null);

        assertThat(response.mode()).isEqualTo("AI");
        assertThat(response.resultKind()).isEqualTo("REFUSAL");
        assertThat(response.turnCount()).isEqualTo(1);
        verify(fixture.aiClient, never()).answer(
                anyString(), anyString(), any(ChatToolRegistry.class), anyBoolean(),
                any(AiChatClient.ToolExecutor.class),
                any(ChatToolService.AssistantCatalogVocabulary.class), any(), any());
        verify(fixture.quota, never()).tryReserve(anyInt());
        verify(fixture.messageRepo).save(argThat(message ->
                "ASSISTANT".equals(message.getRole())
                        && "CONTENT_REFUSAL".equals(message.getSource())));
    }

    @Test
    @DisplayName("AC3: reaching the substantive cap creates a linked successor without a hard stop")
    void turnLimitCreatesLinkedContinuation() {
        Fixture fixture = fixture(true, 60, 0);
        fixture.conversation.setCountedTurns(ChatService.MAX_TURNS);

        ChatMessageResponse response = fixture.service.send(request("Size M còn hàng không?"), null);

        assertThat(fixture.conversation.getEndedReason()).isEqualTo("CONTINUED");
        assertThat(response.conversationId()).isNotEqualTo(CONVERSATION_ID);
        assertThat(response.continuation()).isNotNull();
        assertThat(response.continuation().available()).isTrue();
        assertThat(response.continuation().successorConversationId())
                .isEqualTo(response.conversationId());
        assertThat(response.continuation().message()).contains("không cần kể lại");
        assertThat(response.mode()).isEqualTo("AI");
    }

    @Test
    @DisplayName("each stored end reason tells the customer the truthful reason")
    void endedReasonsUseDistinctCustomerCopy() {
        Fixture offTopic = fixture(true, 60, 0);
        offTopic.conversation.setEndedReason("OFF_TOPIC");
        assertThat(offTopic.service.send(request("Hỏi tiếp"), null).answer())
                .contains("chỉ hỗ trợ sản phẩm và dịch vụ").doesNotContain("lượt hỏi");

        Fixture unavailable = fixture(true, 60, 0);
        unavailable.conversation.setEndedReason("AI_UNAVAILABLE");
        assertThat(unavailable.service.send(request("Hỏi tiếp"), null).answer())
                .contains("đang bận", "thử lại sau").doesNotContain("lượt hỏi");

        Fixture handoff = fixture(true, 60, 0);
        handoff.conversation.setEndedReason("HANDOFF");
        assertThat(handoff.service.send(request("Hỏi tiếp"), null).answer())
                .contains("đã được chuyển sang nhân viên").doesNotContain("lượt hỏi");
    }

    @Test
    @DisplayName("AC2: product-page advice uses the same adjustable 40-turn default")
    void productPageUsesCurrentConversationLimit() {
        Fixture fixture = fixture(true, 60, 0);
        when(fixture.toolService.isPublicSellableProductSlug("ls2-ff800-storm", "vi"))
                .thenReturn(true);
        when(fixture.toolService.resolveFastPath(anyString(), eq("vi"), isNull(), any(), any()))
                .thenReturn(Optional.of(ChatToolService.ToolOutcome.local(
                        "Dạ, em sẽ kiểm tra size và tồn kho của mẫu này cho anh/chị.",
                        "TEMPLATE", false, false, false)));
        ChatMessageRequest productRequest = ChatMessageRequest.builder()
                .conversationId(CONVERSATION_ID)
                .message("Hỏi tiếp")
                .lang("vi")
                .pageContext(new ChatPageContextRequest("PRODUCT", "ls2-ff800-storm"))
                .build();

        ChatMessageResponse response = fixture.service.send(productRequest, null);
        assertThat(response.maxTurns()).isEqualTo(ChatService.MAX_TURNS);
        assertThat(response.turnLimit()).isEqualTo(ChatService.MAX_TURNS);
    }

    private static void assertRecoverable(
            ChatMessageResponse response, ChatConversationEntity conversation) {
        assertThat(response.mode()).isEqualTo("AI");
        assertThat(response.reason()).isEqualTo("AI");
        assertThat(response.handoffRecommended()).isFalse();
        assertThat(response.products()).isEmpty();
        assertThat(response.turnCount()).isZero();
        assertThat(conversation.getEndedReason()).isNull();
    }

    private static void assertClosed(
            ChatMessageResponse response,
            ChatConversationEntity conversation,
            String endedReason,
            int turnCount
    ) {
        assertThat(response.mode()).isEqualTo("CONTACT");
        assertThat(response.reason()).isEqualTo("CONTACT");
        assertThat(conversation.getEndedReason()).isEqualTo(endedReason);
        assertThat(response.turnCount()).isEqualTo(turnCount);
    }

    private static AiChatClient.HybridAnswer hybrid(String answer) {
        return hybrid(answer, List.of());
    }

    private static AiChatClient.HybridAnswer hybrid(
            String answer, List<ChatProductCardResponse> products) {
        return new AiChatClient.HybridAnswer(
                new AiChatClient.Answer(answer, false, false, false),
                products, List.of(), List.of(ChatToolRegistry.SEARCH_PRODUCTS), 1);
    }

    private static AiChatClient.HybridAnswer hybridWithVerifiedRangeTotals() {
        ChatProductCardResponse first = card();
        ChatProductCardResponse second = new ChatProductCardResponse(
                "safe-card-2", "Sản phẩm an toàn 2", null,
                BigDecimal.valueOf(3_600_000), null, "VND", "IN_STOCK");
        ChatProductCardResponse third = new ChatProductCardResponse(
                "safe-card-3", "Sản phẩm an toàn 3", null,
                BigDecimal.valueOf(3_700_000), null, "VND", "IN_STOCK");
        return new AiChatClient.HybridAnswer(
                new AiChatClient.Answer(
                        "Dạ, shop chỉ có 5 mẫu tai nghe. Anh/chị xem các sản phẩm bên dưới để chọn nhé.",
                        false, false, false),
                List.of(first, second, third),
                List.of(),
                List.of(ChatToolRegistry.SEARCH_PRODUCTS),
                java.util.Set.of(),
                1,
                "AI",
                new ChatToolService.CatalogTotals(5, 9, 5L),
                new ChatToolService.SearchScope(
                        "tai-nghe-bluetooth-mu-bao-hiem", null, 3_000_000L, null));
    }

    private static AiChatClient.HybridAnswer hybridWithVerifiedTotals(long count) {
        ChatProductCardResponse second = new ChatProductCardResponse(
                "safe-card-2", "Sản phẩm an toàn 2", null,
                BigDecimal.valueOf(3_600_000), null, "VND", "IN_STOCK");
        ChatProductCardResponse third = new ChatProductCardResponse(
                "safe-card-3", "Sản phẩm an toàn 3", null,
                BigDecimal.valueOf(3_700_000), null, "VND", "IN_STOCK");
        return new AiChatClient.HybridAnswer(
                new AiChatClient.Answer(
                        "Dạ, trong tầm giá anh/chị hỏi, shop có " + count + " mẫu tai nghe. "
                                + "Em đang hiển thị 3 sản phẩm tiêu biểu bên dưới trong tổng "
                                + count + " mẫu phù hợp.",
                        false, false, false),
                List.of(card(), second, third),
                List.of(),
                List.of(ChatToolRegistry.SEARCH_PRODUCTS),
                java.util.Set.of(),
                1,
                "AI",
                new ChatToolService.CatalogTotals(count, count, count),
                new ChatToolService.SearchScope(
                        "tai-nghe-bluetooth-mu-bao-hiem", null, 3_000_000L, 5_000_000L));
    }

    private static ChatProductCardResponse card() {
        return new ChatProductCardResponse(
                "safe-card",
                "Sản phẩm an toàn",
                null,
                BigDecimal.valueOf(1_000_000),
                null,
                "VND",
                "IN_STOCK");
    }

    private static ChatMessageRequest request(String message) {
        return ChatMessageRequest.builder()
                .conversationId(CONVERSATION_ID)
                .message(message)
                .lang("vi")
                .build();
    }

    private static Fixture fixture(boolean enabled, int dailyLimit, long spent) {
        ChatConversationJpaRepository conversations = mock(ChatConversationJpaRepository.class);
        ChatMessageJpaRepository messages = mock(ChatMessageJpaRepository.class);
        ChatLeadJpaRepository leads = mock(ChatLeadJpaRepository.class);
        ChatAssistantSettings settings = mock(ChatAssistantSettings.class);
        ChatToolService toolService = mock(ChatToolService.class);
        AiChatClient aiClient = mock(AiChatClient.class);
        ChatConversationEntity conversation = new ChatConversationEntity();
        conversation.setId(CONVERSATION_ID);
        conversation.setLocale("vi");

        when(conversations.findById(CONVERSATION_ID)).thenReturn(Optional.of(conversation));
        when(conversations.save(any(ChatConversationEntity.class))).thenAnswer(invocation -> {
            ChatConversationEntity saved = invocation.getArgument(0);
            if (saved.getId() == null) saved.setId(UUID.randomUUID());
            return saved;
        });
        when(settings.load("vi")).thenReturn(new ChatAssistantSettings.Snapshot(
                enabled,
                dailyLimit,
                ChatAssistantSettings.defaultGreeting("vi"),
                List.of("Tìm sản phẩm", "Lọc theo ngân sách", "So sánh"),
                CONTACTS,
                "",
                "",
                ""));
        when(settings.currentModel()).thenReturn("gemini-2.5-flash");
        ChatAiQuotaService quota = mock(ChatAiQuotaService.class);
        when(quota.usedToday()).thenReturn(spent);
        when(quota.tryReserve(anyInt())).thenReturn(true);
        when(aiClient.isConfigured()).thenReturn(true);
        bridgeModelAwareAnswer(aiClient);
        when(toolService.assistantCatalogVocabulary())
                .thenReturn(ChatToolService.AssistantCatalogVocabulary.empty());
        ChatHandoffService handoffService = mock(ChatHandoffService.class);
        ChatPhase3Settings phase3Settings = mock(ChatPhase3Settings.class);
        when(phase3Settings.conversationTurnLimit()).thenReturn(ChatService.MAX_TURNS);

        ChatService service = new ChatService(
                conversations,
                messages,
                leads,
                mock(com.bigbike.bigbike_backend.persistence.repository.customer.CustomerJpaRepository.class),
                settings,
                toolService,
                new ChatToolRegistry(),
                aiClient,
                new ChatResponseGuard(),
                quota,
                null,
                null,
                handoffService,
                phase3Settings,
                null,
                mock(AdminChatWsService.class));
        return new Fixture(
                service, conversation, toolService, aiClient, quota, messages, handoffService);
    }

    private static void bridgeModelAwareAnswer(AiChatClient client) {
        when(client.answerWithFallback(
                anyString(), anyString(), anyString(), any(ChatToolRegistry.class),
                anyBoolean(), any(AiChatClient.ToolExecutor.class),
                any(ChatToolService.AssistantCatalogVocabulary.class), any(), any()))
                .thenAnswer(invocation -> client.answer(
                                invocation.getArgument(1), invocation.getArgument(2),
                                invocation.getArgument(3), invocation.getArgument(4),
                                invocation.getArgument(5), invocation.getArgument(6),
                                invocation.getArgument(7), invocation.getArgument(8))
                        .map(answer -> new AiChatClient.ModelAnswer(
                                answer, invocation.getArgument(0), invocation.getArgument(0),
                                false, null)));
    }

    private record Fixture(
            ChatService service,
            ChatConversationEntity conversation,
            ChatToolService toolService,
            AiChatClient aiClient,
            ChatAiQuotaService quota,
            ChatMessageJpaRepository messageRepo,
            ChatHandoffService handoffService
    ) {}
}
