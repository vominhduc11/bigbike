package com.bigbike.bigbike_backend.repository.admin;

import static org.assertj.core.api.Assertions.assertThat;

import com.bigbike.bigbike_backend.persistence.entity.admin.AdminNotificationEntity;
import com.bigbike.bigbike_backend.persistence.entity.admin.AdminNotificationReadEntity;
import com.bigbike.bigbike_backend.persistence.repository.admin.AdminNotificationJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.admin.AdminNotificationReadJpaRepository;
import com.bigbike.bigbike_backend.service.admin.AdminNotificationService;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * PostgreSQL regression coverage for the order-only notification bell's unread count.
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
    @Autowired AdminNotificationReadJpaRepository readRepository;
    @Autowired AdminNotificationService service;
    @Autowired JdbcTemplate jdbcTemplate;

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

        assertThat(inbox.unreadCount()).isGreaterThanOrEqualTo(1);
        assertThat(inbox.items()).hasSizeGreaterThanOrEqualTo(1);
        assertThat(inbox.items())
                .noneMatch(item -> item.notification().getType().startsWith("CHAT_"));
        assertThat(inbox.items()).noneMatch(AdminNotificationService.NotificationView::read);
    }

    @Test
    void countVisibleExcludesRetiredChatNotifications() {
        Instant now = Instant.now();
        persist("NEW_ORDER", now.minus(3, ChronoUnit.HOURS));
        persist("CHAT_LEAD", now.minus(2, ChronoUnit.HOURS));
        persist("CHAT_HANDOFF_WAITING", now.minus(1, ChronoUnit.HOURS));

        long visible = notificationRepository.countVisible();

        assertThat(visible).isGreaterThanOrEqualTo(1);
    }

    @Test
    void countVisibleAfterCountsOnlyNotificationsNewerThanTheMarker() {
        Instant marker = Instant.now().minus(90, ChronoUnit.MINUTES);
        persist("NEW_ORDER", marker.minus(30, ChronoUnit.MINUTES));
        persist("NEW_ORDER", marker.plus(30, ChronoUnit.MINUTES));

        long before = notificationRepository.countVisible();
        long after = notificationRepository.countVisibleAfter(marker);

        assertThat(after).isGreaterThanOrEqualTo(1);
        assertThat(after).isLessThan(before);
    }

    @Test
    void retentionDeletesExpiredRowsWithoutChangingPerAdminReadMarker() {
        ZoneId vietnam = ZoneId.of("Asia/Ho_Chi_Minh");
        ZonedDateTime now = ZonedDateTime.now(vietnam);
        Instant cutoff = now.minusMonths(6).toInstant();
        Instant expiredAt = now.minusMonths(7).toInstant();
        Instant retainedAt = now.minusMonths(5).toInstant();
        UUID adminId = UUID.randomUUID();
        Instant markerAt = now.minusMonths(8).toInstant().truncatedTo(ChronoUnit.MICROS);

        AdminNotificationReadEntity marker = new AdminNotificationReadEntity();
        marker.setAdminId(adminId);
        marker.setLastReadAt(markerAt);
        marker.setUpdatedAt(now.toInstant());
        readRepository.saveAndFlush(marker);

        AdminNotificationEntity expired = persist("NEW_ORDER", expiredAt);
        AdminNotificationEntity retained = persist("NEW_ORDER", retainedAt);

        int deleted = notificationRepository.deleteOlderThanBatch(cutoff, 500);

        assertThat(deleted).isEqualTo(1);
        assertThat(notificationRepository.findById(expired.getId())).isEmpty();
        assertThat(notificationRepository.findById(retained.getId())).isPresent();
        assertThat(readRepository.findById(adminId).orElseThrow().getLastReadAt())
                .isEqualTo(markerAt.truncatedTo(ChronoUnit.MICROS));
    }

    @Test
    void migrationRemovesLegacySharedReadStateIndexAndColumn() {
        Integer legacyColumnCount = jdbcTemplate.queryForObject(
                "select count(*) from information_schema.columns "
                        + "where table_name = 'admin_notifications' and column_name = 'is_read'",
                Integer.class);
        Integer legacyIndexCount = jdbcTemplate.queryForObject(
                "select count(*) from pg_indexes "
                        + "where tablename = 'admin_notifications' "
                        + "and indexname = 'idx_admin_notifications_unread'",
                Integer.class);

        assertThat(legacyColumnCount).isZero();
        assertThat(legacyIndexCount).isZero();
    }
}
