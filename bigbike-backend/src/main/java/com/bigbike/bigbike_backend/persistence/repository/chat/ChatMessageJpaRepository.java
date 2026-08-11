package com.bigbike.bigbike_backend.persistence.repository.chat;

import com.bigbike.bigbike_backend.persistence.entity.chat.ChatMessageEntity;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ChatMessageJpaRepository extends JpaRepository<ChatMessageEntity, UUID> {

    List<ChatMessageEntity> findByConversationIdOrderByCreatedAtAsc(UUID conversationId);

    @Query("""
            select coalesce(sum(case when message.aiCalled = true then 1 else 0 end), 0)
                 + coalesce(sum(case when message.aiRetryCount > 0 then message.aiRetryCount else 0 end), 0)
            from ChatMessageEntity message
            where message.createdAt >= :from and message.createdAt < :to
            """)
    long countAiUsesBetween(@Param("from") Instant from, @Param("to") Instant to);
}
