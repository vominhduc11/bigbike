package com.bigbike.bigbike_backend.persistence.repository.chat;

import com.bigbike.bigbike_backend.persistence.entity.chat.ChatInteractionEntity;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ChatInteractionJpaRepository extends JpaRepository<ChatInteractionEntity, UUID> {

    Optional<ChatInteractionEntity> findByClientEventId(UUID clientEventId);

    Optional<ChatInteractionEntity> findFirstByConversationIdAndAssistantMessageIdAndInteractionTypeAndLeadPromptSequence(
            UUID conversationId,
            UUID assistantMessageId,
            String interactionType,
            Integer leadPromptSequence);

    boolean existsByConversationIdAndInteractionTypeAndLeadPromptSequence(
            UUID conversationId, String interactionType, Integer leadPromptSequence);

    @Query("""
            select interaction.actionType as actionType, count(interaction.id) as clicks
            from ChatInteractionEntity interaction
            where interaction.interactionType = 'ACTION_CLICKED'
              and interaction.createdAt >= :from and interaction.createdAt < :to
            group by interaction.actionType
            """)
    List<ActionClickSummary> summarizeActionClicksBetween(
            @Param("from") Instant from, @Param("to") Instant to);

    @Query("""
            select count(interaction.id)
            from ChatInteractionEntity interaction
            where interaction.interactionType = 'LEAD_PROMPT_VIEWED'
              and interaction.leadPromptSequence = :sequence
              and interaction.createdAt >= :from and interaction.createdAt < :to
            """)
    long countLeadPromptViewsBetween(
            @Param("sequence") int sequence,
            @Param("from") Instant from,
            @Param("to") Instant to);

    interface ActionClickSummary {
        String getActionType();
        Long getClicks();
    }
}
