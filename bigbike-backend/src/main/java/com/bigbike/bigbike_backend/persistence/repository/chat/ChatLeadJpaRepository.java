package com.bigbike.bigbike_backend.persistence.repository.chat;

import com.bigbike.bigbike_backend.persistence.entity.chat.ChatLeadEntity;
import java.time.Instant;
import java.util.Optional;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ChatLeadJpaRepository extends JpaRepository<ChatLeadEntity, UUID> {

    Optional<ChatLeadEntity> findByConversationId(UUID conversationId);

    boolean existsByConversationId(UUID conversationId);

    List<ChatLeadEntity> findAllByConversationIdIn(List<UUID> conversationIds);

    long countByCreatedAtGreaterThanEqualAndCreatedAtLessThan(Instant from, Instant to);
}
