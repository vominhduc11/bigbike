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

public interface ChatConversationJpaRepository
        extends JpaRepository<ChatConversationEntity, UUID>,
        JpaSpecificationExecutor<ChatConversationEntity> {

    long countByStartedAtGreaterThanEqualAndStartedAtLessThan(Instant from, Instant to);

    long countByLeadOfferStatusAndUpdatedAtGreaterThanEqualAndUpdatedAtLessThan(
            String leadOfferStatus, Instant from, Instant to);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select conversation from ChatConversationEntity conversation where conversation.id = :id")
    Optional<ChatConversationEntity> findByIdForUpdate(@Param("id") UUID id);

    long deleteByExpiresAtBefore(Instant cutoff);
}
