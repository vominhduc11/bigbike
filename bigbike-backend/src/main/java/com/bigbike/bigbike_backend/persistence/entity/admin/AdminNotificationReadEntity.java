package com.bigbike.bigbike_backend.persistence.entity.admin;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Per-admin read high-water mark for the notification inbox (AUD-018/AUD-019).
 * Every {@code admin_notifications} row created after this admin's {@code lastReadAt}
 * is unread for that admin. One row per admin.
 */
@Entity
@Table(name = "admin_notification_reads")
@Getter
@Setter
@NoArgsConstructor
public class AdminNotificationReadEntity {

    @Id
    @Column(name = "admin_id")
    private UUID adminId;

    @Column(name = "last_read_at", nullable = false)
    private Instant lastReadAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
