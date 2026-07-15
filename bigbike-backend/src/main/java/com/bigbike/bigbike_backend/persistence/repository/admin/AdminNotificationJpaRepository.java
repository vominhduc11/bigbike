package com.bigbike.bigbike_backend.persistence.repository.admin;

import com.bigbike.bigbike_backend.persistence.entity.admin.AdminNotificationEntity;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AdminNotificationJpaRepository extends JpaRepository<AdminNotificationEntity, UUID> {

    // Recent notifications regardless of read state — read is now tracked per-admin
    // (see AdminNotificationReadEntity), so the inbox shows the shared backlog and the
    // service marks each item read/unread against the caller's own high-water mark.
    List<AdminNotificationEntity> findAllByOrderByCreatedAtDesc(Pageable pageable);

    // Count notifications created strictly after the given instant (per-admin unread count).
    long countByCreatedAtAfter(Instant since);

    // Total count — used when the admin has no read record yet (everything is unread).
    long count();
}
