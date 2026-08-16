package com.bigbike.bigbike_backend.persistence.repository.chat;

import com.bigbike.bigbike_backend.persistence.entity.chat.ChatMessageEntity;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ChatMessageJpaRepository extends JpaRepository<ChatMessageEntity, UUID> {

    List<ChatMessageEntity> findByConversationIdOrderByCreatedAtAsc(UUID conversationId);

    Optional<ChatMessageEntity> findFirstByConversationIdAndRoleOrderByCreatedAtDesc(
            UUID conversationId, String role);

    @Query("""
            select coalesce(sum(case when message.aiCalled = true then 1 else 0 end), 0)
            from ChatMessageEntity message
            where message.createdAt >= :from and message.createdAt < :to
            """)
    long countAiUsesBetween(@Param("from") Instant from, @Param("to") Instant to);

    @Query("""
            select count(message)
            from ChatMessageEntity message
            where message.role = 'ASSISTANT'
              and message.source = 'CONTACT_FALLBACK'
              and message.createdAt >= :from and message.createdAt < :to
            """)
    long countFallbackMessagesBetween(@Param("from") Instant from, @Param("to") Instant to);
}
