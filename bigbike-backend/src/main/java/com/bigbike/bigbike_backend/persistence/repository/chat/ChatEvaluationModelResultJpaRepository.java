package com.bigbike.bigbike_backend.persistence.repository.chat;

import com.bigbike.bigbike_backend.persistence.entity.chat.ChatEvaluationModelResultEntity;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ChatEvaluationModelResultJpaRepository
        extends JpaRepository<ChatEvaluationModelResultEntity, UUID> {
    List<ChatEvaluationModelResultEntity> findByRunIdOrderByModelIdAsc(UUID runId);
    List<ChatEvaluationModelResultEntity> findByRunIdInOrderByRunIdAscModelIdAsc(
            Collection<UUID> runIds);
}
