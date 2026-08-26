package com.bigbike.bigbike_backend.service.chat;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.persistence.entity.chat.ChatConversationEntity;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatConversationJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatVisitorJpaRepository;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;

class ChatRetentionCleanupServiceTest {

    @Test
    void expiredConversationDeletesPrivateImagesBeforeTheConversationRow() {
        ChatConversationJpaRepository conversations = mock(ChatConversationJpaRepository.class);
        ChatVisitorJpaRepository visitors = mock(ChatVisitorJpaRepository.class);
        ChatImageService images = mock(ChatImageService.class);
        ChatConversationEntity expired = new ChatConversationEntity();
        expired.setId(UUID.randomUUID());
        expired.setExpiresAt(Instant.now().minusSeconds(1));
        when(conversations.findByExpiresAtBeforeOrderByExpiresAtAsc(any()))
                .thenReturn(List.of(expired));
        when(images.deleteForConversations(List.of(expired.getId()))).thenReturn(true);
        ChatRetentionCleanupService service = new ChatRetentionCleanupService(
                conversations, visitors, images);

        service.deleteExpiredConversations();

        InOrder order = inOrder(images, conversations);
        order.verify(images).deleteForConversations(List.of(expired.getId()));
        order.verify(conversations).delete(expired);
        verify(images).deleteExpiredImages(any());
    }

    @Test
    void failedObjectDeletionPreventsAFalseSuccessfulHistoryDeletion() {
        ChatConversationJpaRepository conversations = mock(ChatConversationJpaRepository.class);
        ChatVisitorJpaRepository visitors = mock(ChatVisitorJpaRepository.class);
        ChatImageService images = mock(ChatImageService.class);
        ChatConversationEntity expired = new ChatConversationEntity();
        expired.setId(UUID.randomUUID());
        when(conversations.findByExpiresAtBeforeOrderByExpiresAtAsc(any()))
                .thenReturn(List.of(expired));
        when(images.deleteForConversations(List.of(expired.getId()))).thenReturn(false);
        ChatRetentionCleanupService service = new ChatRetentionCleanupService(
                conversations, visitors, images);

        service.deleteExpiredConversations();

        verify(conversations, never()).delete(expired);
    }
}
