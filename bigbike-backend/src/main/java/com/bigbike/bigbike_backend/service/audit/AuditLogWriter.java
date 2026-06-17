package com.bigbike.bigbike_backend.service.audit;

import com.bigbike.bigbike_backend.persistence.entity.audit.AuditLogEntity;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * Central, best-effort writer for audit logs.
 *
 * <p>Audit logging is observability, not business-critical state. A failure to
 * write an audit entry must NEVER roll back or break the originating business
 * action. This writer therefore delegates the actual persist to
 * {@link AuditLogPersister} (which runs in its own {@code REQUIRES_NEW}
 * transaction) and swallows any exception here — outside the inner transaction
 * boundary so the caller's transaction is never marked rollback-only.
 *
 * <p>All services must route audit writes through {@link #save(AuditLogEntity)}
 * instead of calling the repository directly.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AuditLogWriter {

    private final AuditLogPersister persister;

    /**
     * Persist an audit log entry in a separate transaction. Never throws.
     * A logging failure is logged at WARN and swallowed.
     */
    public void save(AuditLogEntity entity) {
        if (entity == null) {
            return;
        }
        try {
            persister.persist(entity);
        } catch (Exception e) {
            log.warn("Audit log write failed (action={}, resourceType={}): {}",
                    entity.getAction(), entity.getResourceType(), e.toString());
        }
    }
}
