package com.bigbike.bigbike_backend.persistence.repository.commerce.returns;

import com.bigbike.bigbike_backend.persistence.entity.commerce.returns.ReturnHistoryEntity;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReturnHistoryJpaRepository extends JpaRepository<ReturnHistoryEntity, UUID> {

    List<ReturnHistoryEntity> findByReturnIdOrderByCreatedAtAsc(UUID returnId);
}
