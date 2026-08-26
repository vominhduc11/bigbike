package com.bigbike.bigbike_backend.persistence.repository.chat;

import com.bigbike.bigbike_backend.persistence.entity.chat.ChatImageEntity;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ChatImageJpaRepository extends JpaRepository<ChatImageEntity, UUID> {

    Optional<ChatImageEntity> findByRequestId(UUID requestId);

    List<ChatImageEntity> findByIdIn(Collection<UUID> ids);

    List<ChatImageEntity> findByConversationIdOrderByCreatedAtAsc(UUID conversationId);

    List<ChatImageEntity> findByCustomerMessageIdInOrderByCreatedAtAsc(Collection<UUID> messageIds);

    long countByConversationIdAndStatusNot(UUID conversationId, String status);

    List<ChatImageEntity> findByExpiresAtBeforeOrderByExpiresAtAsc(Instant cutoff);

    List<ChatImageEntity> findByStatusAndCreatedAtBeforeOrderByCreatedAtAsc(
            String status, Instant cutoff);

    List<ChatImageEntity> findByStatusInAndDeletedAtIsNullOrderByCreatedAtAsc(
            Collection<String> statuses);

    @Query("select image from ChatImageEntity image where image.conversationId in :conversationIds")
    List<ChatImageEntity> findByConversationIds(
            @Param("conversationIds") Collection<UUID> conversationIds);

    long deleteByConversationId(UUID conversationId);
}
