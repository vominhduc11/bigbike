package com.bigbike.bigbike_backend.service.chat;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.persistence.entity.chat.*;
import com.bigbike.bigbike_backend.persistence.repository.chat.*;
import com.bigbike.bigbike_backend.service.catalog.CatalogReadService;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.Test;

class ChatVideoServiceTest {
    private final ChatVideoJpaRepository videos = mock(ChatVideoJpaRepository.class);
    private final ChatConversationJpaRepository conversations = mock(ChatConversationJpaRepository.class);
    private final ChatVideoStorageService storage = mock(ChatVideoStorageService.class);
    private final ChatVideoDailyQuotaService quota = mock(ChatVideoDailyQuotaService.class);
    private final ChatVideoAnalysisClient ai = mock(ChatVideoAnalysisClient.class);
    private final ChatImageService images = mock(ChatImageService.class);
    private final ChatVideoNormalizer normalizer = mock(ChatVideoNormalizer.class);
    private final ChatVideoService service = new ChatVideoService(videos, mock(ChatImageJpaRepository.class),
            mock(ChatMessageJpaRepository.class), conversations, normalizer, storage, quota, ai,
            mock(CatalogReadService.class), images, mock(ChatProductImageFingerprintService.class));

    private ChatVideoEntity video() {
        var video = new ChatVideoEntity();
        video.setId(UUID.randomUUID()); video.setRequestId(UUID.randomUUID());
        video.setConversationId(UUID.randomUUID()); video.setStatus("PENDING");
        video.setExpiresAt(Instant.now().plusSeconds(100)); video.setDeadlineAt(Instant.now().plusSeconds(60));
        video.setStorageBucket("private-test"); video.setStorageObjectKey("chat/videos/test.mp4");
        when(videos.findById(video.getId())).thenReturn(Optional.of(video));
        return video;
    }

    @Test void expiredFilesAreImmediatelyInaccessibleBeforeTheCleanupJobRuns() {
        var video = video(); video.setExpiresAt(Instant.now().minusSeconds(1));
        assertThatThrownBy(() -> service.customerContent(video.getId(), null, UUID.randomUUID()))
                .isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.adminContent(video.getId())).isInstanceOf(NotFoundException.class);
        verifyNoInteractions(storage);
    }

    @Test void anotherVisitorCannotReadTheFile() {
        var video = video();
        var conversation = new ChatConversationEntity(); conversation.setVisitorId(UUID.randomUUID());
        when(conversations.findById(video.getConversationId())).thenReturn(Optional.of(conversation));
        assertThatThrownBy(() -> service.customerContent(video.getId(), null, UUID.randomUUID()))
                .isInstanceOf(NotFoundException.class);
        verifyNoInteractions(storage);
    }

    @Test void anInterruptedProviderRequestCannotReserveAnotherVideoSlot() {
        var video = video(); video.setStatus("PROCESSING");
        UUID messageId = UUID.randomUUID(); video.setCustomerMessageId(messageId);
        var conversation = new ChatConversationEntity(); conversation.setId(video.getConversationId());
        var result = service.processTurn(conversation, messageId, List.of(video.getId()), UUID.randomUUID(), "", "en");
        assertThat(result.result().answer()).contains("temporarily unavailable");
        verifyNoInteractions(quota, ai, storage);
    }

    @Test void deletingOrExpiringFilesDoesNotResetTheTwoVideoConversationLimit() {
        var video = video(); video.setStatus("DELETED");
        UUID visitor = UUID.randomUUID();
        var conversation = new ChatConversationEntity(); conversation.setId(video.getConversationId()); conversation.setVisitorId(visitor);
        when(ai.isConfigured()).thenReturn(true); when(normalizer.isAvailable()).thenReturn(true);
        when(conversations.findByIdForUpdate(conversation.getId())).thenReturn(Optional.of(conversation));
        when(videos.findByConversationIdOrderByCreatedAtAsc(conversation.getId())).thenReturn(List.of(video, video));
        assertThatThrownBy(() -> service.upload(UUID.randomUUID(), conversation.getId(), "en", null, null, visitor, Instant.now()))
                .isInstanceOf(ValidationException.class)
                .satisfies(failure -> assertThat(((ValidationException) failure).details().get(0).code())
                        .isEqualTo("CHAT_VIDEO_CONVERSATION_LIMIT"));
        verify(normalizer, never()).normalize(any(), any()); verifyNoInteractions(quota, storage);
    }

    @Test void failedDeletionBlocksContentAndIsRetriedWithoutDeletingHistory() {
        var video = video(); video.setExpiresAt(Instant.now().minusSeconds(1));
        when(videos.findByExpiresAtBeforeOrderByExpiresAtAsc(any())).thenReturn(List.of(video));
        doThrow(new IllegalStateException("temporary storage failure")).doNothing()
                .when(storage).delete(video.getStorageBucket(), video.getStorageObjectKey());
        assertThat(service.deleteExpiredVideos(Instant.now())).isZero();
        assertThat(video.getStatus()).isEqualTo("DELETING");
        assertThatThrownBy(() -> service.adminContent(video.getId())).isInstanceOf(NotFoundException.class);
        assertThat(service.deleteExpiredVideos(Instant.now())).isEqualTo(1);
        assertThat(video.getStatus()).isEqualTo("DELETED"); assertThat(video.getDeletedAt()).isNotNull();
        verify(videos, never()).delete(any());
    }

    @Test void historyKeepsOnlyAnExpiredPlaceholder() {
        var video = video(); video.setExpiresAt(Instant.now().minusSeconds(1));
        UUID message = UUID.randomUUID(); video.setCustomerMessageId(message);
        when(videos.findByCustomerMessageIdInOrderByCreatedAtAsc(any())).thenReturn(List.of(video));
        var reference = service.referencesByMessageIds(List.of(message)).get(message).get(0);
        assertThat(reference.status()).isEqualTo("DELETED"); assertThat(reference.contentPath()).isNull();
        verifyNoInteractions(storage, ai);
    }
}
