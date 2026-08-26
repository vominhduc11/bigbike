package com.bigbike.bigbike_backend.persistence.repository.chat;

import com.bigbike.bigbike_backend.persistence.entity.chat.ChatInteractionEntity;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
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

    @Modifying
    @Query(value = """
            insert into chat_interactions (
                id, client_event_id, conversation_id, assistant_message_id,
                interaction_type, product_slug, source_interaction_id, cart_item_id, created_at
            ) values (
                gen_random_uuid(), :clientEventId, :conversationId, :assistantMessageId,
                'CART_ADDED', :productSlug, :sourceInteractionId, :cartItemId, now()
            )
            on conflict do nothing
            """, nativeQuery = true)
    int insertCartAddedIfAbsent(
            @Param("clientEventId") UUID clientEventId,
            @Param("conversationId") UUID conversationId,
            @Param("assistantMessageId") UUID assistantMessageId,
            @Param("productSlug") String productSlug,
            @Param("sourceInteractionId") UUID sourceInteractionId,
            @Param("cartItemId") UUID cartItemId);

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

    @Query(value = """
            select count(*)
            from chat_interactions interaction
            join chat_conversations conversation on conversation.id = interaction.conversation_id
            where interaction.interaction_type = :type
              and conversation.started_at >= :from and conversation.started_at < :to
              and interaction.created_at >= conversation.started_at
              and interaction.created_at < conversation.started_at + interval '168 hours'
            """, nativeQuery = true)
    long countFunnelEventsForConversationCohort(
            @Param("type") String type,
            @Param("from") Instant from,
            @Param("to") Instant to);

    interface ActionClickSummary {
        String getActionType();
        Long getClicks();
    }
}
