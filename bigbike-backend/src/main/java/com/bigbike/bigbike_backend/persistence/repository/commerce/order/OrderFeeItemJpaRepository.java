package com.bigbike.bigbike_backend.persistence.repository.commerce.order;

import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderFeeItemEntity;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrderFeeItemJpaRepository extends JpaRepository<OrderFeeItemEntity, UUID> {

    List<OrderFeeItemEntity> findByOrderId(UUID orderId);
}
