package com.bigbike.bigbike_backend.persistence.repository.chat;

import com.bigbike.bigbike_backend.persistence.entity.chat.ChatAiUsageEventEntity;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ChatAiUsageEventJpaRepository
        extends JpaRepository<ChatAiUsageEventEntity, UUID> {

    @Query(value = """
            select category as category,
                   coalesce(sum(estimated_cost_usd), 0) as costUsd,
                   count(*) as eventCount
            from chat_ai_usage_events
            where created_at >= :from and created_at < :to
            group by category
            """, nativeQuery = true)
    List<CategoryCostSummary> summarizeCategories(
            @Param("from") Instant from, @Param("to") Instant to);

    @Query(value = """
            select coalesce(sum(estimated_cost_usd), 0)
            from chat_ai_usage_events
            where created_at >= :from and created_at < :to
            """, nativeQuery = true)
    BigDecimal sumCostBetween(@Param("from") Instant from, @Param("to") Instant to);

    @Query(value = """
            select count(distinct message_id)
            from chat_ai_usage_events
            where category = 'CUSTOMER_TEXT' and fallback = true
              and created_at >= :from and created_at < :to
            """, nativeQuery = true)
    long countFallbacksBetween(@Param("from") Instant from, @Param("to") Instant to);

    @Query(value = """
            select count(distinct message_id)
            from chat_ai_usage_events
            where category = 'CUSTOMER_TEXT' and message_id is not null
              and created_at >= :from and created_at < :to
            """, nativeQuery = true)
    long countTextMessagesBetween(@Param("from") Instant from, @Param("to") Instant to);

    @Query(value = """
            select count(distinct source.conversation_id)
            from (
                select usage.conversation_id
                from chat_ai_usage_events usage
                where usage.conversation_id is not null
                  and usage.category in ('CUSTOMER_TEXT', 'CUSTOMER_IMAGE')
                  and usage.created_at >= :from and usage.created_at < :to
                union
                select message.conversation_id
                from chat_messages message
                where message.conversation_id is not null
                  and message.role = 'ASSISTANT' and message.ai_called = true
                  and message.created_at >= :from and message.created_at < :to
                  and not exists (
                      select 1 from chat_ai_usage_events usage
                      where usage.message_id = message.id
                        and usage.category = 'CUSTOMER_TEXT'
                  )
            ) source
            """, nativeQuery = true)
    long countCustomerAiConversationsBetween(
            @Param("from") Instant from, @Param("to") Instant to);

    @Query(value = """
            select model_id as modelId, count(distinct message_id) as uses,
                   coalesce(sum(estimated_cost_usd), 0) as costUsd
            from chat_ai_usage_events
            where category = 'CUSTOMER_TEXT'
              and created_at >= :from and created_at < :to
            group by model_id
            order by count(distinct message_id) desc, model_id asc
            """, nativeQuery = true)
    List<ModelUsageSummary> summarizeModels(
            @Param("from") Instant from, @Param("to") Instant to);

    @Query(value = """
            select fallback_reason
            from chat_messages
            where fallback_used = true and fallback_reason is not null
              and created_at >= :from and created_at < :to
            order by created_at desc
            limit 1
            """, nativeQuery = true)
    String findLatestFallbackReason(@Param("from") Instant from, @Param("to") Instant to);

    interface CategoryCostSummary {
        String getCategory();
        BigDecimal getCostUsd();
        Long getEventCount();
    }

    interface ModelUsageSummary {
        String getModelId();
        Long getUses();
        BigDecimal getCostUsd();
    }
}
