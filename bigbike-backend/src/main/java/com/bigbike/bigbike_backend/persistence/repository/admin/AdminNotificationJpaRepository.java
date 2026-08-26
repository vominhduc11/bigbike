package com.bigbike.bigbike_backend.persistence.repository.admin;

import com.bigbike.bigbike_backend.persistence.entity.admin.AdminNotificationEntity;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AdminNotificationJpaRepository extends JpaRepository<AdminNotificationEntity, UUID> {

    // Recent notifications regardless of read state — read is now tracked per-admin
    // (see AdminNotificationReadEntity), so the inbox shows the shared backlog and the
    // service marks each item read/unread against the caller's own high-water mark.
    List<AdminNotificationEntity> findAllByOrderByCreatedAtDesc(Pageable pageable);

    // Count notifications created strictly after the given instant (per-admin unread count).
    long countByCreatedAtAfter(Instant since);

    // Total count — used when the admin has no read record yet (everything is unread).
    long count();

    @Query("""
            select n from AdminNotificationEntity n
            where (:includeChat = true and n.type like 'CHAT_%')
               or (:includeOrders = true and n.type not like 'CHAT_%')
            order by n.createdAt desc
            """)
    List<AdminNotificationEntity> findVisible(
            @Param("includeOrders") boolean includeOrders,
            @Param("includeChat") boolean includeChat,
            Pageable pageable);

    // Everything visible to this admin — used when the caller has no read marker yet,
    // in which case the whole backlog counts as unread (see API_CONTRACT.md V339).
    @Query("""
            select count(n) from AdminNotificationEntity n
            where (:includeChat = true and n.type like 'CHAT_%')
               or (:includeOrders = true and n.type not like 'CHAT_%')
            """)
    long countVisible(
            @Param("includeOrders") boolean includeOrders,
            @Param("includeChat") boolean includeChat);

    // Keep :since in a typed comparison only. A `:since is null` branch here renders a bare
    // placeholder that PostgreSQL cannot type ("could not determine data type of parameter"),
    // which 500s the whole inbox — the null case is handled by countVisible above instead.
    @Query("""
            select count(n) from AdminNotificationEntity n
            where ((:includeChat = true and n.type like 'CHAT_%')
                or (:includeOrders = true and n.type not like 'CHAT_%'))
              and n.createdAt > :since
            """)
    long countVisibleAfter(
            @Param("includeOrders") boolean includeOrders,
            @Param("includeChat") boolean includeChat,
            @Param("since") Instant since);
}
