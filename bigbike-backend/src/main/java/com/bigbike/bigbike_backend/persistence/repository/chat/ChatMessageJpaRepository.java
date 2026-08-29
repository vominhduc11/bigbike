package com.bigbike.bigbike_backend.persistence.repository.chat;

import com.bigbike.bigbike_backend.persistence.entity.chat.ChatMessageEntity;
import java.time.Instant;
import java.util.List;
import java.util.Collection;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ChatMessageJpaRepository extends JpaRepository<ChatMessageEntity, UUID> {

    List<ChatMessageEntity> findByConversationIdOrderByCreatedAtAsc(UUID conversationId);

    List<ChatMessageEntity> findByConversationIdInOrderByConversationIdAscSequenceNoAsc(
            Collection<UUID> conversationIds);

    List<ChatMessageEntity> findByConversationIdAndSequenceNoGreaterThanOrderBySequenceNoAsc(
            UUID conversationId, long sequenceNo);

    @Query("select coalesce(max(message.sequenceNo), 0) from ChatMessageEntity message "
            + "where message.conversationId = :conversationId")
    long findMaxSequence(@Param("conversationId") UUID conversationId);

    @Query(value = "select nextval('chat_message_sequence')", nativeQuery = true)
    long nextSequence();

    Optional<ChatMessageEntity> findFirstByConversationIdAndRoleOrderByCreatedAtDesc(
            UUID conversationId, String role);

    Optional<ChatMessageEntity> findFirstByRequestIdAndRole(UUID requestId, String role);

    Optional<ChatMessageEntity> findByIdAndConversationIdAndRole(
            UUID id, UUID conversationId, String role);

    Optional<ChatMessageEntity>
    findFirstByConversationIdAndRoleAndSequenceNoLessThanOrderBySequenceNoDesc(
            UUID conversationId, String role, long beforeSequence);

    List<ChatMessageEntity> findByRoleAndCreatedAtGreaterThanEqualAndCreatedAtLessThanOrderByCreatedAtDesc(
            String role, Instant from, Instant to);

    List<ChatMessageEntity> findTop500ByRoleOrderByCreatedAtDesc(String role);

    @Query(value = """
            select count(*)
            from chat_messages message
            where message.conversation_id = :conversationId
              and message.role = 'ASSISTANT'
              and message.products_json is not null
              and lower(cast(message.products_json as varchar))
                  like lower(concat('%\"slug\":\"', :slug, '\"%'))
            """, nativeQuery = true)
    long countShownProduct(
            @Param("conversationId") UUID conversationId,
            @Param("slug") String slug);

    @Query("""
            select
              coalesce(sum(case when message.resultKind = 'ANSWER' then 1 else 0 end), 0) as answers,
              coalesce(sum(case when message.resultKind = 'PRODUCT_RESULTS' then 1 else 0 end), 0) as productResults,
              coalesce(sum(case when message.resultKind = 'CLARIFICATION' then 1 else 0 end), 0) as clarifications,
              coalesce(sum(case when message.resultKind = 'OUT_OF_SCOPE' then 1 else 0 end), 0) as outOfScope,
              coalesce(sum(case when message.resultKind = 'REFUSAL' then 1 else 0 end), 0) as refusals
            from ChatMessageEntity message
            where message.role = 'ASSISTANT'
              and message.createdAt >= :from and message.createdAt < :to
            """)
    QualitySummary summarizeQualityBetween(@Param("from") Instant from, @Param("to") Instant to);

    interface QualitySummary {
        Long getAnswers();
        Long getProductResults();
        Long getClarifications();
        Long getOutOfScope();
        Long getRefusals();
    }
}
