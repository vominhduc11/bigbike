package com.bigbike.bigbike_backend.service.maintenance;

import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.persistence.entity.maintenance.MaintenanceStateEntity;
import com.bigbike.bigbike_backend.persistence.repository.maintenance.MaintenanceStateJpaRepository;
import java.time.Instant;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Admin-panel maintenance lock (BUSINESS_RULES {@code MAINTENANCE_RULE_001}..{@code _008}).
 *
 * <p>Two states: {@code NORMAL} and {@code ACTIVE} (admin writes rejected with 423 by
 * {@code MaintenanceWriteLockFilter}). Transitions are always manual and always performed by a
 * {@code DEVELOPER} — nothing here auto-transitions, by design: an automatic release could fire
 * mid-migration, which is the exact scenario the lock exists to prevent.
 *
 * <p>The storefront is deliberately untouched by every state.
 */
@Service
@RequiredArgsConstructor
public class MaintenanceService {

    public static final String STATE_NORMAL = "NORMAL";
    public static final String STATE_ACTIVE = "ACTIVE";
    public static final String TOPIC = "/topic/admin/maintenance";

    /**
     * How long {@link #isLocked()} may serve a cached answer. The write-lock filter calls it on
     * every admin mutation, so it must not issue a query per request. A single backend container
     * runs (docker-compose pins {@code container_name}), so the in-process value is authoritative;
     * the TTL only bounds staleness should that ever change.
     */
    private static final long CACHE_TTL_MILLIS = 2_000L;

    private final MaintenanceStateJpaRepository stateRepo;
    private final SimpMessagingTemplate messagingTemplate;

    private volatile boolean cachedLocked;
    private volatile long cachedAtMillis;

    public MaintenanceStatus getStatus() {
        return toStatus(stateRepo.findById(MaintenanceStateEntity.SINGLETON_ID).orElse(null));
    }

    /**
     * True when admin writes must be rejected. Cached — see {@link #CACHE_TTL_MILLIS}.
     *
     * <p>A missing row reads as {@code NORMAL} rather than throwing: tests run against H2 with
     * Flyway disabled, so the migration's seed row does not exist there, and "fail open" is the
     * correct bias for a lock that would otherwise brick the admin panel on a bad deploy.
     */
    public boolean isLocked() {
        long now = System.currentTimeMillis();
        if (now - cachedAtMillis < CACHE_TTL_MILLIS) {
            return cachedLocked;
        }
        boolean locked = STATE_ACTIVE.equals(getStatus().state());
        cachedLocked = locked;
        cachedAtMillis = now;
        return locked;
    }

    @Transactional
    public MaintenanceStatus setState(
            String rawState,
            String staffNote,
            UUID updatedBy
    ) {
        String state = normalizedState(rawState);

        MaintenanceStateEntity entity = stateRepo.findById(MaintenanceStateEntity.SINGLETON_ID)
                .orElseGet(MaintenanceStateEntity::new);
        entity.setId(MaintenanceStateEntity.SINGLETON_ID);
        entity.setState(state);
        entity.setStaffNote(blankToNull(staffNote));
        entity.setUpdatedBy(updatedBy);
        entity.setUpdatedAt(Instant.now());
        stateRepo.save(entity);

        invalidateCache();

        MaintenanceStatus status = toStatus(entity);
        sendAfterCommit(status);
        return status;
    }

    /** Forces the next {@link #isLocked()} call to re-read. Called after every write. */
    public void invalidateCache() {
        cachedAtMillis = 0L;
    }

    private static MaintenanceStatus toStatus(MaintenanceStateEntity entity) {
        if (entity == null) {
            return new MaintenanceStatus(STATE_NORMAL, null, null);
        }
        // A forward-only migration removes UPCOMING. Keep reads safe if an old row is briefly
        // visible during deployment: the removed value is never exposed as a live state.
        String state = STATE_ACTIVE.equals(entity.getState()) ? STATE_ACTIVE : STATE_NORMAL;
        return new MaintenanceStatus(
                state, entity.getStaffNote(), entity.getUpdatedAt());
    }

    private void sendAfterCommit(MaintenanceStatus status) {
        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    messagingTemplate.convertAndSend(TOPIC, status);
                }
            });
        } else {
            messagingTemplate.convertAndSend(TOPIC, status);
        }
    }

    public static String normalizedState(String rawState) {
        String state = rawState == null ? "" : rawState.trim().toUpperCase();
        if (!Set.of(STATE_NORMAL, STATE_ACTIVE).contains(state)) {
            throw ValidationException.fromField(
                    "state", "INVALID_VALUE", "Trạng thái bảo trì phải là NORMAL hoặc ACTIVE.");
        }
        return state;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }
}
