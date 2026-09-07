package com.bigbike.bigbike_backend.service.chat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.api.chat.dto.ChatContactResponse;
import com.bigbike.bigbike_backend.api.chat.dto.ChatMessageRequest;
import com.bigbike.bigbike_backend.api.chat.dto.ChatMessageResponse;
import com.bigbike.bigbike_backend.api.chat.dto.ChatProductCardResponse;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatConversationEntity;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatMessageEntity;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatConversationJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatMessageJpaRepository;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

/**
 * Measured on the live shop on 2026-09-07: a photo sent together with "cái mũ này giá bao nhiêu
 * vậy shop?" came back with the recognition sentence and no price at all, while the identical
 * question asked one message later was answered correctly. The image branch returned before the
 * text advisory ever ran. These tests pin the fix, and pin the outcomes that must still stop.
 */
class ChatImageChainedTurnTest {

    private static final String RECOGNITION =
            "Ảnh này trông giống mẫu Mũ Tanami bên em đang bán.";
    private static final String PRICE_ANSWER = "Mũ Tanami đang bán giá 6.100.000 ₫.";

    @Test
    void aQuestionTypedWithThePhotoIsAnsweredInTheSameReply() {
        Fixture fixture = fixture();
        fixture.imageResult(imageResult(true, card("mu-tanami")));
        fixture.fastPathAnswer(PRICE_ANSWER, List.of(card("mu-tanami")));

        ChatMessageResponse response = fixture.send("Cái mũ này giá bao nhiêu vậy shop?");

        assertThat(response.answer()).contains(RECOGNITION).contains(PRICE_ANSWER);
        assertThat(response.products()).extracting(ChatProductCardResponse::slug)
                .containsExactly("mu-tanami");

        // One assistant row per request id: chat_messages has a unique index on (request_id, role),
        // so a second row for the same turn would be rejected outright.
        List<ChatMessageEntity> assistantRows = fixture.savedMessages().stream()
                .filter(message -> "ASSISTANT".equals(message.getRole()))
                .toList();
        assertThat(assistantRows).hasSize(1);
        assertThat(assistantRows.get(0).getContent()).isEqualTo(response.answer());
        assertThat(assistantRows.get(0).getResultKind()).isEqualTo(response.resultKind());
    }

    @Test
    void theCustomerTurnIsStoredOnceEvenWithoutARequestIdToDeduplicateIt() {
        Fixture fixture = fixture();
        fixture.imageResult(imageResult(true, card("mu-tanami")));
        fixture.fastPathAnswer(PRICE_ANSWER, List.of(card("mu-tanami")));

        fixture.sendWithoutRequestId("Cái mũ này giá bao nhiêu vậy shop?");

        assertThat(fixture.savedMessages()).filteredOn(m -> "CUSTOMER".equals(m.getRole()))
                .hasSize(1);
        assertThat(fixture.conversation.getCountedTurns()).isEqualTo(1);
    }

    @Test
    void thePhotographedModelIsWhatTheTextHalfTalksAbout() {
        Fixture fixture = fixture();
        fixture.imageResult(imageResult(true, card("mu-tanami")));
        fixture.fastPathAnswer(PRICE_ANSWER, List.of(card("mu-tanami")));

        fixture.send("Cái mũ này giá bao nhiêu vậy shop?");

        ArgumentCaptor<ChatToolService.ConversationContext> context =
                ArgumentCaptor.forClass(ChatToolService.ConversationContext.class);
        verify(fixture.tools).resolveFastPath(
                anyString(), anyString(), any(), any(), context.capture());
        assertThat(context.getValue().productSlugs()).startsWith("mu-tanami");
    }

    @Test
    void aPhotoSentWithNoWordsBehavesExactlyAsBefore() {
        Fixture fixture = fixture();
        fixture.imageResult(imageResult(true, card("mu-tanami")));

        ChatMessageResponse response = fixture.send(null);

        assertThat(response.answer()).isEqualTo(RECOGNITION);
        verify(fixture.tools, never()).resolveFastPath(anyString(), anyString(), any(), any(), any());
    }

    @Test
    void anOutcomeThatDeliberatelyEndsTheTurnNeverReachesTheTextAdvisory() {
        Fixture fixture = fixture();
        fixture.imageResult(new ChatImageService.ImageTurnResult(
                "Em không đoán size mũ từ ảnh đầu hoặc ảnh người.",
                ChatMessageSource.TOOL, "ANSWER", List.of(), true, false));

        ChatMessageResponse response = fixture.send("Mũ này có size nào ạ?");

        assertThat(response.answer()).isEqualTo("Em không đoán size mũ từ ảnh đầu hoặc ảnh người.");
        verify(fixture.tools, never()).resolveFastPath(anyString(), anyString(), any(), any(), any());
    }

    @Test
    void anUnrecognizedPhotoStillGetsTheTypedQuestionAnswered() {
        Fixture fixture = fixture();
        fixture.imageResult(new ChatImageService.ImageTurnResult(
                "Em chưa nhận ra đáng tin cậy được sản phẩm cụ thể trong ảnh.",
                ChatMessageSource.TOOL, "CLARIFICATION", List.of(), true, true));
        fixture.fastPathAnswer(PRICE_ANSWER, List.of(card("mu-tanami")));

        ChatMessageResponse response = fixture.send("Mũ Tanami giá bao nhiêu?");

        assertThat(response.answer()).contains("chưa nhận ra").contains(PRICE_ANSWER);
    }

    @Test
    void cardsFromThePhotoAndFromTheAnswerAreMergedWithoutDuplicates() {
        Fixture fixture = fixture();
        fixture.imageResult(imageResult(true, card("mu-tanami")));
        fixture.fastPathAnswer(PRICE_ANSWER, List.of(card("mu-tanami"), card("mu-khac")));

        ChatMessageResponse response = fixture.send("Còn mẫu nào giống không shop?");

        assertThat(response.products()).extracting(ChatProductCardResponse::slug)
                .containsExactly("mu-tanami", "mu-khac");
        assertThat(response.resultKind()).isEqualTo("PRODUCT_RESULTS");
    }

    private static ChatImageService.ImageTurnResult imageResult(
            boolean continuesToText, ChatProductCardResponse... cards) {
        return new ChatImageService.ImageTurnResult(
                RECOGNITION, ChatMessageSource.TOOL, "PRODUCT_RESULTS", List.of(cards),
                true, continuesToText);
    }

    private static ChatProductCardResponse card(String slug) {
        return new ChatProductCardResponse(
                slug, "Mũ " + slug, "/media/helmet.png",
                BigDecimal.valueOf(6_100_000), null, "VND", "IN_STOCK");
    }

    private static Fixture fixture() {
        UUID conversationId = UUID.randomUUID();
        ChatConversationJpaRepository conversations = mock(ChatConversationJpaRepository.class);
        ChatMessageJpaRepository messages = mock(ChatMessageJpaRepository.class);
        ChatAssistantSettings settings = mock(ChatAssistantSettings.class);
        ChatToolService tools = mock(ChatToolService.class);
        AiChatClient client = mock(AiChatClient.class);
        ChatAiQuotaService quota = mock(ChatAiQuotaService.class);
        ChatImageService images = mock(ChatImageService.class);

        ChatConversationEntity conversation = new ChatConversationEntity();
        conversation.setId(conversationId);
        conversation.setLocale("vi");

        List<ChatMessageEntity> saved = new java.util.ArrayList<>();
        when(conversations.findById(conversationId)).thenReturn(Optional.of(conversation));
        when(conversations.save(any(ChatConversationEntity.class)))
                .thenAnswer(call -> call.getArgument(0));
        when(messages.findByConversationIdOrderByCreatedAtAsc(conversationId))
                .thenAnswer(ignored -> List.copyOf(saved));
        when(messages.nextSequence()).thenReturn(1L, 2L, 3L, 4L);
        when(messages.save(any(ChatMessageEntity.class))).thenAnswer(call -> {
            ChatMessageEntity message = call.getArgument(0);
            saved.add(message);
            return message;
        });
        when(settings.load("vi")).thenReturn(new ChatAssistantSettings.Snapshot(
                true, 400, true,
                new ChatContactResponse("0900000000", "", "", "", ""), "", "", "", 12,
                ChatAssistantSettings.BankDetails.empty(),
                ChatAssistantSettings.PolicyText.empty(),
                ChatAssistantSettings.PolicyText.empty()));
        when(client.isConfigured()).thenReturn(true);
        when(quota.tryReserve(400)).thenReturn(true);
        when(tools.resolveFastPath(anyString(), anyString(), any(), any(), any()))
                .thenReturn(Optional.empty());
        when(tools.assistantCatalogVocabulary())
                .thenReturn(ChatToolService.AssistantCatalogVocabulary.empty());
        // A chained turn calls the budgeted overload; a plain one calls the original.
        when(client.answer(anyString(), anyString(), any(), anyBoolean(), any(), any(), any(),
                any(), any())).thenReturn(Optional.empty());
        when(client.answer(anyString(), anyString(), any(), anyBoolean(), any(), any(), any(),
                any())).thenReturn(Optional.empty());

        ChatService service = new ChatService(
                conversations, messages, settings, tools, new ChatToolRegistry(), client,
                // No sales advisor: ChatService then passes the guarded answer through untouched,
                // which keeps these assertions about the chaining itself.
                new ChatResponseGuard(), quota, null, null,
                images);
        return new Fixture(service, tools, images, conversation, conversationId, saved);
    }

    private static boolean anyBoolean() {
        return org.mockito.ArgumentMatchers.anyBoolean();
    }

    private record Fixture(
            ChatService service,
            ChatToolService tools,
            ChatImageService images,
            ChatConversationEntity conversation,
            UUID conversationId,
            List<ChatMessageEntity> saved
    ) {
        void imageResult(ChatImageService.ImageTurnResult result) {
            when(images.processTurn(any(), any(), any(), anyString(), anyString()))
                    .thenReturn(result);
        }

        void fastPathAnswer(String answer, List<ChatProductCardResponse> products) {
            when(tools.resolveFastPath(anyString(), anyString(), any(), any(), any()))
                    .thenReturn(Optional.of(new ChatToolService.ToolOutcome(
                            false, answer, ChatMessageSource.TOOL, null, products,
                            false, false, List.of(), Set.of(), false, null, List.of(),
                            null, null, null)));
        }

        List<ChatMessageEntity> savedMessages() {
            return saved;
        }

        ChatMessageResponse send(String message) {
            return service.send(request(message, UUID.randomUUID()), null);
        }

        ChatMessageResponse sendWithoutRequestId(String message) {
            return service.send(request(message, null), null);
        }

        private ChatMessageRequest request(String message, UUID requestId) {
            return ChatMessageRequest.builder()
                    .conversationId(conversationId)
                    .requestId(requestId)
                    .message(message)
                    .lang("vi")
                    .imageIds(List.of(UUID.randomUUID()))
                    .build();
        }
    }
}
