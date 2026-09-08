package com.bigbike.bigbike_backend.persistence.repository.chat;

import com.bigbike.bigbike_backend.persistence.entity.chat.ChatVideoEntity;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ChatVideoJpaRepository extends JpaRepository<ChatVideoEntity, UUID> {

    Optional<ChatVideoEntity> findByRequestId(UUID requestId);

    List<ChatVideoEntity> findByIdIn(Collection<UUID> ids);

    List<ChatVideoEntity> findByConversationIdOrderByCreatedAtAsc(UUID conversationId);

    List<ChatVideoEntity> findByCustomerMessageIdInOrderByCreatedAtAsc(Collection<UUID> messageIds);

    long countByConversationIdAndStatusNot(UUID conversationId, String status);

    List<ChatVideoEntity> findByExpiresAtBeforeOrderByExpiresAtAsc(Instant cutoff);

    List<ChatVideoEntity> findByStatusAndCreatedAtBeforeOrderByCreatedAtAsc(
            String status, Instant cutoff);

    List<ChatVideoEntity> findByStatusInAndDeletedAtIsNullOrderByCreatedAtAsc(
            Collection<String> statuses);

    @Query("select video from ChatVideoEntity video where video.conversationId in :conversationIds")
    List<ChatVideoEntity> findByConversationIds(
            @Param("conversationIds") Collection<UUID> conversationIds);

    long deleteByConversationId(UUID conversationId);
}
