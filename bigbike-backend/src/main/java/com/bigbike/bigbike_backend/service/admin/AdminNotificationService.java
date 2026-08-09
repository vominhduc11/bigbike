package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.persistence.entity.admin.AdminNotificationEntity;
import com.bigbike.bigbike_backend.persistence.entity.admin.AdminNotificationReadEntity;
import com.bigbike.bigbike_backend.persistence.repository.admin.AdminNotificationJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.admin.AdminNotificationReadJpaRepository;
import com.bigbike.bigbike_backend.service.ws.OrderWsEvent;
import com.bigbike.bigbike_backend.service.ws.ChatLeadWsEvent;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AdminNotificationService {

    private static final int MAX_FETCH = 50;

    private final AdminNotificationJpaRepository notificationRepo;
    private final AdminNotificationReadJpaRepository readRepo;

    @Transactional
    public void persistFromWsEvent(OrderWsEvent event) {
        AdminNotificationEntity n = new AdminNotificationEntity();
        n.setType(event.type());
        n.setOrderId(event.orderId());
        n.setOrderNumber(event.orderNumber());
        n.setPayload(buildPayload(event));
        n.setCreatedAt(Instant.now());
        notificationRepo.save(n);
    }

    @Transactional
    public void persistChatLead(ChatLeadWsEvent event) {
        AdminNotificationEntity notification = new AdminNotificationEntity();
        notification.setType(event.type());
        // The shared notification inbox is readable by every authenticated admin. Keep PII out
        // of that payload; phone/name/note stay behind the chat.read-protected detail endpoint
        // and realtime topic. The conversation id is sufficient for an authorized admin to open it.
        notification.setPayload("{\"type\":\"CHAT_LEAD\""
                + ",\"conversationId\":\"" + event.conversationId() + "\"}");
        notification.setCreatedAt(event.timestamp() == null ? Instant.now() : event.timestamp());
        notificationRepo.save(notification);
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
        Instant lastReadAt = readRepo.findById(adminId)
                .map(AdminNotificationReadEntity::getLastReadAt)
                .orElse(null);

        List<AdminNotificationEntity> recent =
                notificationRepo.findAllByOrderByCreatedAtDesc(PageRequest.of(0, MAX_FETCH));

        List<NotificationView> items = recent.stream()
                .map(n -> new NotificationView(n, isReadForAdmin(n, lastReadAt)))
                .toList();

        long unreadCount = lastReadAt == null
                ? notificationRepo.count()
                : notificationRepo.countByCreatedAtAfter(lastReadAt);

        return new InboxView(items, unreadCount);
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
