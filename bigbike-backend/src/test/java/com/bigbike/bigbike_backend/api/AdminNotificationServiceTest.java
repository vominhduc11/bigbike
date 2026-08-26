package com.bigbike.bigbike_backend.api;

import static org.assertj.core.api.Assertions.assertThat;

import com.bigbike.bigbike_backend.service.admin.AdminNotificationService;
import com.bigbike.bigbike_backend.service.admin.AdminNotificationService.InboxView;
import com.bigbike.bigbike_backend.service.admin.AdminNotificationService.NotificationView;
import com.bigbike.bigbike_backend.service.ws.OrderWsEvent;
import com.bigbike.bigbike_backend.service.ws.ChatHandoffWsEvent;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.jdbc.Sql;

/**
 * Per-admin read model for the notification inbox (AUD-017/AUD-018/AUD-019):
 * each admin keeps their own unread state; one admin marking read must not clear
 * unread for another; and the shared backlog is never lost.
 */
@SpringBootTest
@Sql(scripts = "/db/test-seed.sql", executionPhase = Sql.ExecutionPhase.BEFORE_TEST_CLASS)
class AdminNotificationServiceTest {

    @Autowired
    AdminNotificationService service;

    private OrderWsEvent newOrderEvent() {
        return new OrderWsEvent(
                "NEW_ORDER", UUID.randomUUID(),
                "BB-NOTIF-" + UUID.randomUUID().toString().substring(0, 8),
                "Nguyễn Văn A", BigDecimal.valueOf(1_500_000), "PROCESSING", "COD",
                Instant.now());
    }

    @Test
    void markAllRead_isPerAdmin_doesNotClearUnreadForOtherAdmins() {
        UUID adminA = UUID.randomUUID();
        UUID adminB = UUID.randomUUID();

        service.persistFromWsEvent(newOrderEvent());
        service.persistFromWsEvent(newOrderEvent());

        long unreadA0 = service.inboxFor(adminA).unreadCount();
        long unreadB0 = service.inboxFor(adminB).unreadCount();
        assertThat(unreadA0).isGreaterThanOrEqualTo(2);
        assertThat(unreadB0).isEqualTo(unreadA0);

        // Admin A opens the bell → only A's marker advances.
        service.markAllReadFor(adminA);

        assertThat(service.inboxFor(adminA).unreadCount()).isZero();
        // Admin B still has the same unread backlog — not cleared by A (AUD-018).
        assertThat(service.inboxFor(adminB).unreadCount()).isEqualTo(unreadB0);
    }

    @Test
    void inbox_keepsBacklogVisibleAfterMarkAllRead() {
        UUID admin = UUID.randomUUID();
        service.persistFromWsEvent(newOrderEvent());
        service.persistFromWsEvent(newOrderEvent());

        int before = service.inboxFor(admin).items().size();
        assertThat(before).isGreaterThanOrEqualTo(2);

        service.markAllReadFor(admin);

        // Backlog is still listed (read=true), not removed — AUD-019.
        InboxView after = service.inboxFor(admin);
        assertThat(after.items().size()).isEqualTo(before);
        assertThat(after.unreadCount()).isZero();
        assertThat(after.items()).allMatch(NotificationView::read);
    }

    @Test
    void payload_carriesCustomerNameAndTotal() {
        UUID admin = UUID.randomUUID();
        OrderWsEvent event = newOrderEvent();
        service.persistFromWsEvent(event);

        InboxView inbox = service.inboxFor(admin);
        String payload = inbox.items().stream()
                .map(v -> v.notification().getPayload())
                .filter(p -> p != null && p.contains(event.orderNumber()))
                .findFirst()
                .orElseThrow();

        // AUD-026: offline admin catching up sees who ordered and how much.
        assertThat(payload).contains("\"customerName\":\"Nguyễn Văn A\"");
        assertThat(payload).contains("\"total\":1500000");
    }

    @Test
    void inboxIsPermissionScopedBetweenOrdersAndChat() {
        service.persistFromWsEvent(newOrderEvent());
        service.persistChatHandoff(new ChatHandoffWsEvent(
                "CHAT_HANDOFF_WAITING", UUID.randomUUID(), UUID.randomUUID(),
                "Size M còn không?",
                java.util.List.of(new ChatHandoffWsEvent.ProductReference("mu-a", "Mũ A")),
                false, "GUEST", Instant.now(), 1));

        InboxView ordersOnly = service.inboxFor(UUID.randomUUID(), true, false);
        InboxView chatOnly = service.inboxFor(UUID.randomUUID(), false, true);

        assertThat(ordersOnly.items()).allMatch(item ->
                !item.notification().getType().startsWith("CHAT_"));
        assertThat(chatOnly.items()).isNotEmpty().allMatch(item ->
                item.notification().getType().startsWith("CHAT_"));
        assertThat(chatOnly.items()).extracting(item -> item.notification().getPayload())
                .allMatch(payload -> !payload.contains("phone") && !payload.contains("email"));
    }
}
