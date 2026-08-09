package com.bigbike.bigbike_backend.persistence.repository.chat;

import com.bigbike.bigbike_backend.persistence.entity.chat.ChatConversationEntity;
import java.time.Instant;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface ChatConversationJpaRepository
        extends JpaRepository<ChatConversationEntity, UUID>,
        JpaSpecificationExecutor<ChatConversationEntity> {

    long countByStartedAtGreaterThanEqualAndStartedAtLessThan(Instant from, Instant to);

    long deleteByExpiresAtBefore(Instant cutoff);
}
