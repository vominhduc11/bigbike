package com.bigbike.bigbike_backend.persistence.repository.catalog;

import com.bigbike.bigbike_backend.persistence.entity.catalog.OrderLineItemSerialEntity;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface OrderLineItemSerialJpaRepository
        extends JpaRepository<OrderLineItemSerialEntity, UUID> {

    List<OrderLineItemSerialEntity> findByOrderLineItemId(UUID orderLineItemId);

    @Query("""
        SELECT olis FROM OrderLineItemSerialEntity olis
        WHERE olis.orderLineItemId IN (
            SELECT li.id FROM OrderLineItemEntity li WHERE li.order.id = :orderId
        )
        """)
    List<OrderLineItemSerialEntity> findByOrderId(@Param("orderId") UUID orderId);

    boolean existsBySerialId(UUID serialId);

    void deleteByOrderLineItemId(UUID orderLineItemId);
}
