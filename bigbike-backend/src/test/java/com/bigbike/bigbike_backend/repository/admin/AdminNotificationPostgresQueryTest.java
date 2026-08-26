package com.bigbike.bigbike_backend.repository.admin;

import static org.assertj.core.api.Assertions.assertThat;

import com.bigbike.bigbike_backend.persistence.entity.admin.AdminNotificationEntity;
import com.bigbike.bigbike_backend.persistence.repository.admin.AdminNotificationJpaRepository;
import com.bigbike.bigbike_backend.service.admin.AdminNotificationService;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * PostgreSQL regression coverage for the notification bell's unread count.
 *
 * <p>The H2 suite cannot catch this class of bug: H2 accepts a bare placeholder in an
 * {@code :param is null} branch, while PostgreSQL rejects it with "could not determine
 * data type of parameter", which turned every GET /api/v1/admin/notifications into a 500.
 * An admin who has never opened the bell has no read marker, so the null branch is the
 * default path, not an edge case.
 */
@SpringBootTest
@ActiveProfiles("tc")
@Testcontainers
@Transactional
class AdminNotificationPostgresQueryTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired AdminNotificationJpaRepository notificationRepository;
    @Autowired AdminNotificationService service;

    private AdminNotificationEntity persist(String type, Instant createdAt) {
        AdminNotificationEntity notification = new AdminNotificationEntity();
        notification.setType(type);
        notification.setPayload("{\"type\":\"" + type + "\"}");
        notification.setCreatedAt(createdAt);
        return notificationRepository.saveAndFlush(notification);
    }

    @Test
    void inboxLoadsForAdminWithoutReadMarker() {
        Instant now = Instant.now();
        persist("NEW_ORDER", now.minus(2, ChronoUnit.HOURS));
        persist("CHAT_HANDOFF_WAITING", now.minus(1, ChronoUnit.HOURS));

        // Never opened the bell → no read marker → the whole visible backlog is unread.
        AdminNotificationService.InboxView inbox = service.inboxFor(UUID.randomUUID());

        assertThat(inbox.unreadCount()).isGreaterThanOrEqualTo(2);
        assertThat(inbox.items()).hasSizeGreaterThanOrEqualTo(2);
        assertThat(inbox.items()).noneMatch(AdminNotificationService.NotificationView::read);
    }

    @Test
    void countVisibleRespectsPermissionScopeWithoutSinceBound() {
        Instant now = Instant.now();
        persist("NEW_ORDER", now.minus(3, ChronoUnit.HOURS));
        persist("CHAT_LEAD", now.minus(2, ChronoUnit.HOURS));
        persist("CHAT_HANDOFF_WAITING", now.minus(1, ChronoUnit.HOURS));

        long ordersOnly = notificationRepository.countVisible(true, false);
        long chatOnly = notificationRepository.countVisible(false, true);
        long both = notificationRepository.countVisible(true, true);

        assertThat(ordersOnly).isGreaterThanOrEqualTo(1);
        assertThat(chatOnly).isGreaterThanOrEqualTo(2);
        assertThat(both).isEqualTo(ordersOnly + chatOnly);
    }

    @Test
    void countVisibleAfterCountsOnlyNotificationsNewerThanTheMarker() {
        Instant marker = Instant.now().minus(90, ChronoUnit.MINUTES);
        persist("NEW_ORDER", marker.minus(30, ChronoUnit.MINUTES));
        persist("NEW_ORDER", marker.plus(30, ChronoUnit.MINUTES));

        long before = notificationRepository.countVisible(true, true);
        long after = notificationRepository.countVisibleAfter(true, true, marker);

        assertThat(after).isGreaterThanOrEqualTo(1);
        assertThat(after).isLessThan(before);
    }
}
