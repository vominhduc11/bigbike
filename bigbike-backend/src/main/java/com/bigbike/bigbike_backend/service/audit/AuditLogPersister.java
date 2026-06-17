package com.bigbike.bigbike_backend.service.audit;

import com.bigbike.bigbike_backend.persistence.entity.audit.AuditLogEntity;
import com.bigbike.bigbike_backend.persistence.repository.audit.AuditLogJpaRepository;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Persists a single audit log entry in its own transaction so a failure is
 * isolated from the calling business transaction. Must be a separate Spring
 * bean from {@link AuditLogWriter} so the {@code REQUIRES_NEW} proxy is applied
 * (self-invocation would bypass it) and so the try/catch in the writer sits
 * OUTSIDE this transactional boundary.
 *
 * <p>The repository is looked up via {@link ObjectProvider} so this bean works
 * even in the mock/read-only profile where the JPA repository is absent — in
 * that case the write is a silent no-op.
 */
@Component
@RequiredArgsConstructor
class AuditLogPersister {

    private final ObjectProvider<AuditLogJpaRepository> repoProvider;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void persist(AuditLogEntity entity) {
        AuditLogJpaRepository repo = repoProvider.getIfAvailable();
        if (repo == null) {
            return; // mock / read-only profile — no persistence
        }
        if (entity.getCreatedAt() == null) {
            entity.setCreatedAt(Instant.now());
        }
        repo.save(entity);
    }
}
