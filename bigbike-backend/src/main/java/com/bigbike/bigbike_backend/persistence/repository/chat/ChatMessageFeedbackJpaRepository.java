package com.bigbike.bigbike_backend.persistence.repository.chat;

import com.bigbike.bigbike_backend.persistence.entity.chat.ChatMessageFeedbackEntity;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ChatMessageFeedbackJpaRepository extends JpaRepository<ChatMessageFeedbackEntity, UUID> {
    Optional<ChatMessageFeedbackEntity> findByMessageId(UUID messageId);
    long countByRatingAndCreatedAtGreaterThanEqualAndCreatedAtLessThan(String rating, Instant from, Instant to);
    List<ChatMessageFeedbackEntity>
            findTop5000ByRatingAndCreatedAtGreaterThanEqualAndCreatedAtLessThanOrderByCreatedAtDesc(
                    String rating, Instant from, Instant to);

    @Query("select feedback.topicCode as topicCode, feedback.reason as reason, count(feedback) as total "
            + "from ChatMessageFeedbackEntity feedback where feedback.rating = 'UNHELPFUL' "
            + "and feedback.createdAt >= :from and feedback.createdAt < :to "
            + "group by feedback.topicCode, feedback.reason order by count(feedback) desc")
    List<IssueSummary> summarizeIssues(@Param("from") Instant from, @Param("to") Instant to);

    interface IssueSummary {
        String getTopicCode();
        String getReason();
        Long getTotal();
    }
}
