package com.bigbike.bigbike_backend.persistence.repository.commerce.cart;

import com.bigbike.bigbike_backend.persistence.entity.commerce.cart.CartEntity;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CartJpaRepository extends JpaRepository<CartEntity, UUID> {

    List<CartEntity> findByCustomerId(UUID customerId);

    Optional<CartEntity> findByCustomerIdAndStatus(UUID customerId, String status);

    List<CartEntity> findBySessionId(String sessionId);

    List<CartEntity> findBySessionIdAndStatus(String sessionId, String status);

    Page<CartEntity> findByStatus(String status, Pageable pageable);

    Page<CartEntity> findByExpiresAtBefore(Instant threshold, Pageable pageable);

    @Modifying
    @Query(value = """
            with candidates as (
                select id
                from carts
                where status in ('ACTIVE', 'MERGED')
                  and expires_at is not null
                  and expires_at < :cutoff
                order by expires_at, id
                limit :batchSize
                for update skip locked
            )
            delete from carts cart
            using candidates
            where cart.id = candidates.id
            """, nativeQuery = true)
    int deleteExpiredRetentionBatch(@Param("cutoff") Instant cutoff, @Param("batchSize") int batchSize);

    @Modifying
    @Query(value = """
            with candidates as (
                select id
                from maintenance_cart_purge_runs
                where completed_at is not null
                  and completed_at < :cutoff
                order by completed_at, id
                limit :batchSize
                for update skip locked
            )
            delete from maintenance_cart_purge_runs run
            using candidates
            where run.id = candidates.id
            """, nativeQuery = true)
    int deleteExpiredPurgeBackupRunsBatch(@Param("cutoff") Instant cutoff, @Param("batchSize") int batchSize);
}
