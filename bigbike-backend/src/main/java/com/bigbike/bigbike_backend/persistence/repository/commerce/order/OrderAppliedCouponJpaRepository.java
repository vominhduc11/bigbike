package com.bigbike.bigbike_backend.persistence.repository.commerce.order;

import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderAppliedCouponEntity;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrderAppliedCouponJpaRepository extends JpaRepository<OrderAppliedCouponEntity, UUID> {

    List<OrderAppliedCouponEntity> findByOrderId(UUID orderId);

    List<OrderAppliedCouponEntity> findByCode(String code);
}
