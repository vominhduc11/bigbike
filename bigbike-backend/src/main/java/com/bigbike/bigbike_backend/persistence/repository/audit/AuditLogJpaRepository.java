package com.bigbike.bigbike_backend.persistence.repository.audit;

import com.bigbike.bigbike_backend.persistence.entity.audit.AuditLogEntity;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AuditLogJpaRepository extends JpaRepository<AuditLogEntity, UUID> {

    List<AuditLogEntity> findByActorId(UUID actorId);

    List<AuditLogEntity> findByResourceTypeAndResourceId(String resourceType, UUID resourceId);
}
