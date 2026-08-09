package com.bigbike.bigbike_backend.persistence.repository.chat;

import com.bigbike.bigbike_backend.persistence.entity.chat.ChatMessageEntity;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ChatMessageJpaRepository extends JpaRepository<ChatMessageEntity, UUID> {

    List<ChatMessageEntity> findByConversationIdOrderByCreatedAtAsc(UUID conversationId);

    long countByAiCalledTrueAndCreatedAtGreaterThanEqualAndCreatedAtLessThan(
            Instant from, Instant to);
}
