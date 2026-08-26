package com.bigbike.bigbike_backend.persistence.repository.chat;

import com.bigbike.bigbike_backend.persistence.entity.chat.ChatOrderAttributionEntity;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ChatOrderAttributionJpaRepository
        extends JpaRepository<ChatOrderAttributionEntity, UUID> {

    boolean existsByOrderLineItemId(UUID orderLineItemId);

    List<ChatOrderAttributionEntity> findByConversationId(UUID conversationId);

    @Query("""
            select count(distinct attribution.orderId)
            from ChatOrderAttributionEntity attribution
            where attribution.createdAt >= :from and attribution.createdAt < :to
            """)
    long countAssistedOrdersBetween(@Param("from") Instant from, @Param("to") Instant to);

    @Query("""
            select coalesce(sum(attribution.attributedAmount), 0)
            from ChatOrderAttributionEntity attribution
            where attribution.createdAt >= :from and attribution.createdAt < :to
            """)
    java.math.BigDecimal sumAssistedRevenueBetween(
            @Param("from") Instant from,
            @Param("to") Instant to);

    @Query(value = """
            select count(distinct attribution.order_id)
            from chat_order_attributions attribution
            join chat_conversations conversation on conversation.id = attribution.conversation_id
            where conversation.started_at >= :from and conversation.started_at < :to
              and attribution.touch_at >= conversation.started_at
              and attribution.touch_at < conversation.started_at + interval '168 hours'
            """, nativeQuery = true)
    long countOrdersForConversationCohort(
            @Param("from") Instant from,
            @Param("to") Instant to);

    @Query(value = """
            select coalesce(sum(attribution.attributed_amount), 0)
            from chat_order_attributions attribution
            join chat_conversations conversation on conversation.id = attribution.conversation_id
            where conversation.started_at >= :from and conversation.started_at < :to
              and attribution.touch_at >= conversation.started_at
              and attribution.touch_at < conversation.started_at + interval '168 hours'
            """, nativeQuery = true)
    java.math.BigDecimal sumRevenueForConversationCohort(
            @Param("from") Instant from,
            @Param("to") Instant to);

    @Query("""
            select attribution.actionType as actionType,
                   count(distinct attribution.orderId) as orders,
                   coalesce(sum(attribution.attributedAmount), 0) as revenue
            from ChatOrderAttributionEntity attribution
            where attribution.actionType is not null
              and attribution.createdAt >= :from and attribution.createdAt < :to
            group by attribution.actionType
            """)
    List<ActionOrderSummary> summarizeActionsBetween(
            @Param("from") Instant from, @Param("to") Instant to);

    interface ActionOrderSummary {
        String getActionType();
        Long getOrders();
        java.math.BigDecimal getRevenue();
    }
}
