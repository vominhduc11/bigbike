package com.bigbike.bigbike_backend.persistence.repository.commerce.order;

import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderAddressEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrderAddressJpaRepository extends JpaRepository<OrderAddressEntity, UUID> {

    List<OrderAddressEntity> findByOrderId(UUID orderId);

    Optional<OrderAddressEntity> findByOrderIdAndType(UUID orderId, String type);
}
