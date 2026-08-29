package com.bigbike.bigbike_backend.persistence.repository.chat;

import com.bigbike.bigbike_backend.persistence.entity.chat.ChatConversationEntity;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import org.springframework.data.jpa.repository.Modifying;

public interface ChatConversationJpaRepository
        extends JpaRepository<ChatConversationEntity, UUID>,
        JpaSpecificationExecutor<ChatConversationEntity> {

    long countByStartedAtGreaterThanEqualAndStartedAtLessThan(Instant from, Instant to);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select conversation from ChatConversationEntity conversation where conversation.id = :id")
    Optional<ChatConversationEntity> findByIdForUpdate(@Param("id") UUID id);

    long deleteByExpiresAtBefore(Instant cutoff);
    List<ChatConversationEntity> findByExpiresAtBeforeOrderByExpiresAtAsc(Instant cutoff);

    Optional<ChatConversationEntity> findFirstByVisitorIdOrderByLastMessageAtDesc(UUID visitorId);
    Optional<ChatConversationEntity> findFirstByVisitorIdAndCustomerIdOrderByLastMessageAtDesc(
            UUID visitorId, UUID customerId);
    Optional<ChatConversationEntity> findFirstByVisitorIdAndCustomerIdIsNullOrderByLastMessageAtDesc(
            UUID visitorId);
    List<ChatConversationEntity> findByVisitorIdOrderByLastMessageAtAsc(UUID visitorId);
    List<ChatConversationEntity> findByCustomerIdOrderByLastMessageAtAsc(UUID customerId);
    long deleteByVisitorId(UUID visitorId);
    long deleteByCustomerId(UUID customerId);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update ChatConversationEntity conversation set conversation.customerId = :customerId "
            + "where conversation.visitorId = :visitorId "
            + "and (conversation.customerId is null or conversation.customerId = :customerId)")
    int attachVisitorConversations(
            @Param("visitorId") UUID visitorId, @Param("customerId") UUID customerId);
}
