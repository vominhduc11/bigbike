package com.bigbike.bigbike_backend.persistence.repository.commerce.order;

import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderHistoryBatchEntity;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrderHistoryBatchJpaRepository extends JpaRepository<OrderHistoryBatchEntity, UUID> {
    boolean existsByActiveTrue();
}
