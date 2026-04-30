package com.bigbike.bigbike_backend.persistence.repository.audit;

import com.bigbike.bigbike_backend.persistence.entity.audit.AuditLogEntity;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface AuditLogJpaRepository
        extends JpaRepository<AuditLogEntity, UUID>, JpaSpecificationExecutor<AuditLogEntity> {

    List<AuditLogEntity> findByActorId(UUID actorId);

    List<AuditLogEntity> findByResourceTypeAndResourceId(String resourceType, UUID resourceId);
}
