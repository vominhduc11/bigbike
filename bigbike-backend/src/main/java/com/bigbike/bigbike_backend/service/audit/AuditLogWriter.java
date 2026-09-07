package com.bigbike.bigbike_backend.service.audit;

import com.bigbike.bigbike_backend.persistence.entity.audit.AuditLogEntity;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * Central writer for audit logs.
 *
 * <p>General observability entries use {@link #save(AuditLogEntity)}. A failure to
 * write those entries does not roll back the originating business action.
 * This writer delegates their persistence to
 * {@link AuditLogPersister} (which runs in its own {@code REQUIRES_NEW}
 * transaction) and swallows any exception here — outside the inner transaction
 * boundary so the caller's transaction is never marked rollback-only.
 *
 * <p>Business-required evidence, such as PAY_RULE_002 bank receipt confirmation,
 * uses {@link #saveRequired(AuditLogEntity)} in the caller's transaction instead.
 * Its failure must roll back the receipt. Services use these methods rather
 * than calling the repository directly.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AuditLogWriter {

    private final AuditLogPersister persister;

    /** PAY_RULE_002: receipt and its audit must either both commit or both roll back. */
    public void saveRequired(AuditLogEntity entity) {
        persister.persistRequired(entity);
    }

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
