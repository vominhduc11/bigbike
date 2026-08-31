package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.persistence.entity.admin.AdminNotificationEntity;
import com.bigbike.bigbike_backend.persistence.entity.admin.AdminNotificationReadEntity;
import com.bigbike.bigbike_backend.persistence.repository.admin.AdminNotificationJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.admin.AdminNotificationReadJpaRepository;
import com.bigbike.bigbike_backend.service.ws.OrderWsEvent;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AdminNotificationService {

    private static final int MAX_FETCH = 50;

    private final AdminNotificationJpaRepository notificationRepo;
    private final AdminNotificationReadJpaRepository readRepo;

    // REQUIRES_NEW, not the default REQUIRED. This is invoked from
    // TransactionSynchronization.afterCommit() by AdminOrderWsService.
    // At that point the original transaction has already committed but its EntityManager is
    // still bound to the thread, so REQUIRED silently *joins* that dead transaction: the row
    // only ever reaches the persistence context, nothing flushes, and cleanup closes the
    // EntityManager and drops it — with no exception raised. That left admin_notifications
    // permanently empty while order events kept arriving.
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void persistFromWsEvent(OrderWsEvent event) {
        AdminNotificationEntity n = new AdminNotificationEntity();
        n.setType(event.type());
        n.setOrderId(event.orderId());
        n.setOrderNumber(event.orderNumber());
        n.setPayload(buildPayload(event));
        n.setCreatedAt(Instant.now());
        notificationRepo.save(n);
    }

    /**
     * Persists one aggregate reminder inside the caller's transaction. Unlike the
     * after-commit WebSocket path above, this must remain atomic with the daily run
     * and per-order de-duplication ledgers.
     */
    @Transactional
    public UUID persistOverdueOrderDigest(int count, int thresholdDays, Instant cutoffAt) {
        AdminNotificationEntity notification = new AdminNotificationEntity();
        notification.setType("ORDER_OVERDUE_DIGEST");
        notification.setOrderId(null);
        notification.setOrderNumber(null);
        notification.setPayload("{\"schemaVersion\":1"
                + ",\"count\":" + count
                + ",\"thresholdDays\":" + thresholdDays
                + ",\"cutoffAt\":\"" + cutoffAt + "\"}");
        notification.setCreatedAt(Instant.now());
        return notificationRepo.saveAndFlush(notification).getId();
    }

    /** Persists the immutable inventory snapshot inside the daily-run transaction. */
    @Transactional
    public UUID persistInventoryDigest(String payload, Instant createdAt) {
        AdminNotificationEntity notification = new AdminNotificationEntity();
        notification.setType("INVENTORY_OUT_OF_STOCK_DIGEST");
        notification.setPayload(payload);
        notification.setCreatedAt(createdAt);
        return notificationRepo.saveAndFlush(notification).getId();
    }

    /** One inbox item with the caller's own read state resolved. */
    public record NotificationView(AdminNotificationEntity notification, boolean read) {}

    public record InboxView(List<NotificationView> items, long unreadCount) {}

    /**
     * Recent notifications (up to {@value #MAX_FETCH}) plus this admin's unread count.
     * Each item's read flag is computed against the caller's own high-water mark, so two
     * admins on the same browser never see each other's read state (AUD-017/AUD-018).
     */
    @Transactional(readOnly = true)
    public InboxView inboxFor(UUID adminId) {
        return inboxFor(adminId, true, false);
    }

    @Transactional(readOnly = true)
    public InboxView inboxFor(UUID adminId, boolean includeOrders, boolean includeInventory) {
        if (!includeOrders && !includeInventory) {
            throw new IllegalArgumentException("At least one notification scope is required.");
        }
        Instant lastReadAt = readRepo.findById(adminId)
                .map(AdminNotificationReadEntity::getLastReadAt)
                .orElse(null);

        PageRequest page = PageRequest.of(0, MAX_FETCH);
        List<AdminNotificationEntity> recent = includeOrders && includeInventory
                ? notificationRepo.findAllVisible(page)
                : includeOrders
                        ? notificationRepo.findVisible(page)
                        : notificationRepo.findInventoryVisible(page);

        List<NotificationView> items = recent.stream()
                .map(n -> new NotificationView(n, isReadForAdmin(n, lastReadAt)))
                .toList();

        // No marker yet means this admin has never opened the bell — the whole visible
        // backlog is unread. Only the marked case may be counted with a since bound.
        long unreadCount = countVisible(includeOrders, includeInventory, lastReadAt);

        return new InboxView(items, unreadCount);
    }

    private long countVisible(boolean includeOrders, boolean includeInventory, Instant lastReadAt) {
        if (includeOrders && includeInventory) {
            return lastReadAt == null
                    ? notificationRepo.countAllVisible()
                    : notificationRepo.countAllVisibleAfter(lastReadAt);
        }
        if (includeOrders) {
            return lastReadAt == null
                    ? notificationRepo.countVisible()
                    : notificationRepo.countVisibleAfter(lastReadAt);
        }
        return lastReadAt == null
                ? notificationRepo.countInventoryVisible()
                : notificationRepo.countInventoryVisibleAfter(lastReadAt);
    }

    /**
     * Advances only THIS admin's read marker to now — the shared notification rows are
     * never mutated, so other admins keep their own unread state and no backlog is lost
     * (AUD-018/AUD-019).
     *
     * @return the caller's unread count after marking (0).
     */
    @Transactional
    public long markAllReadFor(UUID adminId) {
        Instant now = Instant.now();
        AdminNotificationReadEntity state = readRepo.findById(adminId)
                .orElseGet(() -> {
                    AdminNotificationReadEntity fresh = new AdminNotificationReadEntity();
                    fresh.setAdminId(adminId);
                    return fresh;
                });
        state.setLastReadAt(now);
        state.setUpdatedAt(now);
        readRepo.save(state);
        return 0L;
    }

    private static boolean isReadForAdmin(AdminNotificationEntity n, Instant lastReadAt) {
        return lastReadAt != null
                && n.getCreatedAt() != null
                && !n.getCreatedAt().isAfter(lastReadAt);
    }

    private String buildPayload(OrderWsEvent event) {
        // Include customerName + total so an offline admin catching up on the persisted
        // inbox sees who ordered and how much, not just the order number (AUD-026).
        return "{\"type\":\"" + jsonEscape(event.type()) + "\""
                + ",\"orderNumber\":\"" + jsonEscape(event.orderNumber()) + "\""
                + ",\"customerName\":\"" + jsonEscape(event.customerName()) + "\""
                + ",\"total\":" + (event.total() != null ? event.total().toPlainString() : "null")
                + ",\"status\":\"" + jsonEscape(event.status()) + "\""
                + ",\"paymentMethod\":\"" + jsonEscape(event.paymentMethod()) + "\"}";
    }

    private static String jsonEscape(String value) {
        if (value == null) return "";
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }

}
