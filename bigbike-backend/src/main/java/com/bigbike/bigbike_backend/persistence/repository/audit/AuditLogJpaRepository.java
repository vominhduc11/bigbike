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

    @Modifying
    @Query(value = """
            with candidates as (
                select id
                from audit_logs
                where created_at < :cutoff
                order by created_at, id
                limit :batchSize
                for update skip locked
            )
            delete from audit_logs log
            using candidates
            where log.id = candidates.id
            """, nativeQuery = true)
    int deleteOlderThanBatch(@Param("cutoff") java.time.Instant cutoff, @Param("batchSize") int batchSize);
}
