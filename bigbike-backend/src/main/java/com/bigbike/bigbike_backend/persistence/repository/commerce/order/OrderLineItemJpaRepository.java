package com.bigbike.bigbike_backend.persistence.repository.commerce.order;

import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderLineItemEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrderLineItemJpaRepository extends JpaRepository<OrderLineItemEntity, UUID> {

    List<OrderLineItemEntity> findByOrderId(UUID orderId);

    Optional<OrderLineItemEntity> findByLegacyItemId(Long legacyItemId);

    long countByOrderId(UUID orderId);
}
