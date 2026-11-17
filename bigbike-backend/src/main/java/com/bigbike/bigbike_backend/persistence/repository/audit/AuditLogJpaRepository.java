package com.bigbike.bigbike_backend.persistence.repository.audit;

import com.bigbike.bigbike_backend.persistence.entity.audit.AuditLogEntity;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AuditLogJpaRepository
        extends JpaRepository<AuditLogEntity, UUID>, JpaSpecificationExecutor<AuditLogEntity> {

    List<AuditLogEntity> findByActorId(UUID actorId);

    List<AuditLogEntity> findByResourceTypeAndResourceId(String resourceType, UUID resourceId);

    boolean existsByActionAndResourceTypeAndResourceId(String action, String resourceType, UUID resourceId);

    /**
     * Reservations are the durable ledger. Preserve known pre-journal successes and
     * failures conservatively, without counting a journaled review a second time.
     * The prefix belongs exclusively to our versioned, controlled journal format;
     * arbitrary legacy audit text is never cast to JSON or a numeric identifier.
     */
    @Query(value = """
            select
                (select count(*) from audit_logs a
                 where a.action = 'REVIEW_AI_ATTEMPT_RESERVED' and a.resource_type = 'REVIEW'
                   and a.created_at >= :start and a.created_at < :end)
                +
                (select count(*) from reviews r
                 where r.moderation_checked_at >= :start and r.moderation_checked_at < :end
                   and (r.moderation_source = 'AI'
                        or (r.moderation_source = 'SKIPPED' and r.moderation_reason = 'AI_UNAVAILABLE'))
                   and not exists (
                       select 1 from audit_logs a
                       where a.action = 'REVIEW_AI_ATTEMPT_RESERVED' and a.resource_type = 'REVIEW'
                         and a.after_data like '{"version":1,"reviewId":' || r.id || ',"reservationDay":%'))
            """, nativeQuery = true)
    long countReviewAiAttempts(@Param("start") java.time.Instant start, @Param("end") java.time.Instant end);

    @Modifying
    @Query(value = """
            with candidates as (
                select a.id
                from audit_logs a
                where a.created_at < :cutoff
                  and not (
                      a.action = 'REVIEW_AI_ATTEMPT_RESERVED' and a.resource_type = 'REVIEW'
                      and exists (
                          select 1 from reviews r
                          where a.after_data like '{"version":1,"reviewId":' || r.id || ',"reservationDay":%'
                            and not (
                                coalesce(r.moderation_source, '') = 'AI'
                                or (coalesce(r.moderation_source, '') = 'SKIPPED'
                                    and coalesce(r.moderation_reason, '') = 'AI_UNAVAILABLE'))))
                order by a.created_at, a.id
                limit :batchSize
                for update skip locked
            )
            delete from audit_logs log
            using candidates
            where log.id = candidates.id
            """, nativeQuery = true)
    int deleteOlderThanBatch(@Param("cutoff") java.time.Instant cutoff, @Param("batchSize") int batchSize);
}
