package com.bigbike.bigbike_backend.service.maintenance;

import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.persistence.entity.maintenance.MaintenanceStateEntity;
import com.bigbike.bigbike_backend.persistence.repository.maintenance.MaintenanceStateJpaRepository;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Admin-panel maintenance lock (BUSINESS_RULES {@code MAINTENANCE_RULE_001}..{@code _007}).
 *
 * <p>Three states: {@code NORMAL} → {@code UPCOMING} (staff warned, writes still allowed)
 * → {@code ACTIVE} (admin writes rejected with 423 by {@code MaintenanceWriteLockFilter}).
 * Transitions are always manual and always performed by a {@code DEVELOPER} — nothing here
 * auto-transitions, by design: an automatic release could fire mid-migration, which is the
 * exact scenario the lock exists to prevent.
 *
 * <p>The storefront is deliberately untouched by every state.
 */
@Service
@RequiredArgsConstructor
public class MaintenanceService {

    public static final String STATE_NORMAL = "NORMAL";
    public static final String STATE_UPCOMING = "UPCOMING";
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
            String rawExpectedAt,
            UUID updatedBy
    ) {
        String state = normalizedState(rawState);
        Instant expectedAt = normalizeExpectedAt(rawExpectedAt);

        MaintenanceStateEntity entity = stateRepo.findById(MaintenanceStateEntity.SINGLETON_ID)
                .orElseGet(MaintenanceStateEntity::new);
        entity.setId(MaintenanceStateEntity.SINGLETON_ID);
        entity.setState(state);
        entity.setStaffNote(blankToNull(staffNote));
        entity.setExpectedAt(expectedAt);
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
            return new MaintenanceStatus(STATE_NORMAL, null, null, null);
        }
        String state = entity.getState() == null ? STATE_NORMAL : entity.getState();
        return new MaintenanceStatus(
                state, entity.getStaffNote(), entity.getExpectedAt(), entity.getUpdatedAt());
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
        if (!Set.of(STATE_NORMAL, STATE_UPCOMING, STATE_ACTIVE).contains(state)) {
            throw ValidationException.fromField(
                    "state", "INVALID_VALUE", "Trạng thái bảo trì phải là NORMAL, UPCOMING hoặc ACTIVE.");
        }
        return state;
    }

    private static Instant normalizeExpectedAt(String rawExpectedAt) {
        if (rawExpectedAt == null || rawExpectedAt.isBlank()) return null;
        String value = rawExpectedAt.trim();
        try {
            return OffsetDateTime.parse(value).toInstant();
        } catch (DateTimeParseException ex) {
            try {
                return Instant.parse(value);
            } catch (DateTimeParseException ignored) {
                throw ValidationException.fromField(
                        "expectedAt", "INVALID_VALUE", "expectedAt phải là thời điểm ISO-8601 hợp lệ.");
            }
        }
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }
}
