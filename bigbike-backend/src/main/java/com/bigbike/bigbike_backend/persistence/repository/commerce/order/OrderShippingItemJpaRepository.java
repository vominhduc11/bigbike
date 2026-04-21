package com.bigbike.bigbike_backend.persistence.repository.commerce.order;

import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderShippingItemEntity;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrderShippingItemJpaRepository extends JpaRepository<OrderShippingItemEntity, UUID> {

    List<OrderShippingItemEntity> findByOrderId(UUID orderId);
}
