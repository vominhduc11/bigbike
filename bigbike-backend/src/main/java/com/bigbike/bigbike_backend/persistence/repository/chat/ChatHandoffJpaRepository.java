package com.bigbike.bigbike_backend.persistence.repository.chat;

import com.bigbike.bigbike_backend.persistence.entity.chat.ChatHandoffEntity;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ChatHandoffJpaRepository extends JpaRepository<ChatHandoffEntity, UUID> {

    Optional<ChatHandoffEntity> findByRequestId(UUID requestId);

    Optional<ChatHandoffEntity> findFirstByConversationIdAndStatus(
            UUID conversationId, String status);

    Optional<ChatHandoffEntity> findFirstByConversationIdOrderByRequestedAtDesc(UUID conversationId);

    @Query("select handoff from ChatHandoffEntity handoff where handoff.conversationId = :conversationId "
            + "and handoff.status in ('WAITING', 'ACTIVE') order by handoff.requestedAt desc")
    List<ChatHandoffEntity> findLiveForConversation(@Param("conversationId") UUID conversationId);

    @Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("select handoff from ChatHandoffEntity handoff where handoff.id = :id")
    Optional<ChatHandoffEntity> findByIdForUpdate(@Param("id") UUID id);

    List<ChatHandoffEntity> findByStatusOrderByRequestedAtAsc(String status);

    List<ChatHandoffEntity> findByStatusInOrderByRequestedAtAsc(List<String> statuses);

    long countByStatus(String status);

    long countByStatusAndRequestedAtGreaterThanEqualAndRequestedAtLessThan(
            String status, Instant from, Instant to);
}
