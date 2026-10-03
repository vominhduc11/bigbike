package com.bigbike.bigbike_backend.persistence.repository.analytics;

import com.bigbike.bigbike_backend.persistence.entity.analytics.Ga4EventOutboxEntity;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface Ga4EventOutboxJpaRepository extends JpaRepository<Ga4EventOutboxEntity, UUID> {

    boolean existsByOrderIdAndEventName(UUID orderId, String eventName);

    Optional<Ga4EventOutboxEntity> findByOrderIdAndEventName(UUID orderId, String eventName);

    @Query(value = """
            select * from ga4_event_outbox
            where status = 'PENDING' and next_attempt_at <= :now
            order by next_attempt_at, id
            for update skip locked
            limit 1
            """, nativeQuery = true)
    Optional<Ga4EventOutboxEntity> findNextPendingForUpdate(@Param("now") Instant now);
}
