package com.bigbike.bigbike_backend.service.inventory;

import com.bigbike.bigbike_backend.persistence.repository.admin.AdminNotificationJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.inventory.InventoryOutOfStockDigestRunJpaRepository;
import com.bigbike.bigbike_backend.service.admin.AdminNotificationService;
import com.bigbike.bigbike_backend.service.ws.AdminInventoryWsService;
import com.bigbike.bigbike_backend.service.ws.InventoryWsEvent;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

@Service
@RequiredArgsConstructor
public class InventoryOutOfStockDigestCoordinator {

    private static final String EMPTY = "EMPTY";
    private static final String NOTIFIED = "NOTIFIED";
    private static final String READY_EVENT = "INVENTORY_OUT_OF_STOCK_DIGEST_READY";

    private final InventoryOutOfStockDigestRunJpaRepository runRepository;
    private final AdminNotificationJpaRepository notificationRepository;
    private final AdminNotificationService notificationService;
    private final AdminInventoryWsService inventoryWsService;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public boolean hasRun(LocalDate digestDate) {
        return runRepository.existsById(digestDate);
    }

    /**
     * Claims the local date first, then persists the notification in the same transaction.
     * ON CONFLICT makes concurrent scheduler instances collapse into one bulletin.
     */
    @Transactional
    public boolean record(InventoryOutOfStockDigest digest) {
        String outcome = digest.isEmpty() ? EMPTY : NOTIFIED;
        if (runRepository.insertIfAbsent(digest.digestDate(), outcome, digest.generatedAt()) == 0) {
            return false;
        }
        if (digest.isEmpty()) {
            return true;
        }

        String payload;
        try {
            payload = objectMapper.writeValueAsString(digest);
        } catch (Exception exception) {
            throw new IllegalStateException("Cannot serialize out-of-stock digest.", exception);
        }
        UUID notificationId = notificationService.persistInventoryDigest(payload, digest.generatedAt());
        if (runRepository.attachNotification(digest.digestDate(), notificationId) != 1) {
            throw new IllegalStateException("Cannot attach the out-of-stock notification to its daily run.");
        }
        inventoryWsService.pushEvent(new InventoryWsEvent(READY_EVENT, null, digest.generatedAt()));
        return true;
    }

    /** Atomically consumes the one email attempt and returns its immutable payload. */
    @Transactional
    public Optional<String> claimPendingEmail(LocalDate digestDate, Instant attemptedAt) {
        if (runRepository.claimEmail(digestDate, attemptedAt) == 0) {
            return Optional.empty();
        }
        UUID notificationId = runRepository.findById(digestDate)
                .map(run -> run.getNotificationId())
                .orElseThrow(() -> new IllegalStateException("Claimed digest run disappeared."));
        return notificationRepository.findById(notificationId)
                .map(notification -> notification.getPayload())
                .filter(payload -> payload != null && !payload.isBlank());
    }

    @Transactional
    public void recordEmailResult(LocalDate digestDate, boolean accepted) {
        if (runRepository.recordEmailResult(digestDate, accepted) != 1) {
            throw new IllegalStateException("Cannot record the out-of-stock email result.");
        }
    }
}
