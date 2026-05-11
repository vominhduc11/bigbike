package com.bigbike.bigbike_backend.persistence.repository.commerce.order;

import com.bigbike.bigbike_backend.persistence.entity.commerce.order.CheckoutIdempotencyKeyEntity;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CheckoutIdempotencyKeyJpaRepository extends JpaRepository<CheckoutIdempotencyKeyEntity, UUID> {

    Optional<CheckoutIdempotencyKeyEntity> findByFlowTypeAndScopeKeyAndIdempotencyKey(
            String flowType,
            String scopeKey,
            String idempotencyKey
    );

    @Modifying
    @Query("UPDATE CheckoutIdempotencyKeyEntity k SET k.orderId = :orderId, k.updatedAt = :now WHERE k.id = :id")
    void attachOrder(
            @Param("id") UUID id,
            @Param("orderId") UUID orderId,
            @Param("now") Instant now
    );

    @Modifying
    @Query("DELETE FROM CheckoutIdempotencyKeyEntity k WHERE k.createdAt < :cutoff")
    int deleteOlderThan(@Param("cutoff") Instant cutoff);
}
