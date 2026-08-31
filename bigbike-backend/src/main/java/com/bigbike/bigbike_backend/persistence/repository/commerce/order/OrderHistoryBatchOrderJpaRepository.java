package com.bigbike.bigbike_backend.persistence.repository.commerce.order;

import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderHistoryBatchOrderEntity;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface OrderHistoryBatchOrderJpaRepository
        extends JpaRepository<OrderHistoryBatchOrderEntity, UUID> {

    @Query("""
            select membership from OrderHistoryBatchOrderEntity membership
            join fetch membership.batch batch
            where membership.order.id in :orderIds and batch.active = true
            """)
    List<OrderHistoryBatchOrderEntity> findActiveByOrderIds(
            @Param("orderIds") Collection<UUID> orderIds);

    @Query("""
            select membership from OrderHistoryBatchOrderEntity membership
            join fetch membership.batch batch
            where membership.order.id = :orderId and batch.active = true
            """)
    Optional<OrderHistoryBatchOrderEntity> findActiveByOrderId(@Param("orderId") UUID orderId);
}
