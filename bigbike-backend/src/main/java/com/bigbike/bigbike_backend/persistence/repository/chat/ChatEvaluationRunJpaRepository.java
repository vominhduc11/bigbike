package com.bigbike.bigbike_backend.persistence.repository.chat;

import com.bigbike.bigbike_backend.persistence.entity.chat.ChatEvaluationRunEntity;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ChatEvaluationRunJpaRepository
        extends JpaRepository<ChatEvaluationRunEntity, UUID> {
    List<ChatEvaluationRunEntity> findTop50ByOrderByCreatedAtDesc();
}
