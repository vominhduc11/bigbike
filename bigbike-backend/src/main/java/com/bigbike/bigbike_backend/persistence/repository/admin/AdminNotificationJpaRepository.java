package com.bigbike.bigbike_backend.persistence.repository.admin;

import com.bigbike.bigbike_backend.persistence.entity.admin.AdminNotificationEntity;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AdminNotificationJpaRepository extends JpaRepository<AdminNotificationEntity, UUID> {

    @Query("""
            select n from AdminNotificationEntity n
            where n.type like 'ORDER_%' or n.type = 'NEW_ORDER'
            order by n.createdAt desc
            """)
    List<AdminNotificationEntity> findVisible(Pageable pageable);

    @Query("""
            select n from AdminNotificationEntity n
            where n.type = 'INVENTORY_OUT_OF_STOCK_DIGEST'
            order by n.createdAt desc
            """)
    List<AdminNotificationEntity> findInventoryVisible(Pageable pageable);

    @Query("""
            select n from AdminNotificationEntity n
            where n.type like 'ORDER_%'
               or n.type = 'NEW_ORDER'
               or n.type = 'INVENTORY_OUT_OF_STOCK_DIGEST'
            order by n.createdAt desc
            """)
    List<AdminNotificationEntity> findAllVisible(Pageable pageable);

    // Everything visible to this admin — used when the caller has no read marker yet,
    // in which case the whole backlog counts as unread (see API_CONTRACT.md V339).
    @Query("""
            select count(n) from AdminNotificationEntity n
            where n.type like 'ORDER_%' or n.type = 'NEW_ORDER'
            """)
    long countVisible();

    @Query("""
            select count(n) from AdminNotificationEntity n
            where n.type = 'INVENTORY_OUT_OF_STOCK_DIGEST'
            """)
    long countInventoryVisible();

    @Query("""
            select count(n) from AdminNotificationEntity n
            where n.type like 'ORDER_%'
               or n.type = 'NEW_ORDER'
               or n.type = 'INVENTORY_OUT_OF_STOCK_DIGEST'
            """)
    long countAllVisible();

    // Keep :since in a typed comparison only. A `:since is null` branch here renders a bare
    // placeholder that PostgreSQL cannot type ("could not determine data type of parameter"),
    // which 500s the whole inbox — the null case is handled by countVisible above instead.
    @Query("""
            select count(n) from AdminNotificationEntity n
            where (n.type like 'ORDER_%' or n.type = 'NEW_ORDER')
              and n.createdAt > :since
            """)
    long countVisibleAfter(@Param("since") Instant since);

    @Query("""
            select count(n) from AdminNotificationEntity n
            where n.type = 'INVENTORY_OUT_OF_STOCK_DIGEST'
              and n.createdAt > :since
            """)
    long countInventoryVisibleAfter(@Param("since") Instant since);

    @Query("""
            select count(n) from AdminNotificationEntity n
            where (n.type like 'ORDER_%'
                or n.type = 'NEW_ORDER'
                or n.type = 'INVENTORY_OUT_OF_STOCK_DIGEST')
              and n.createdAt > :since
            """)
    long countAllVisibleAfter(@Param("since") Instant since);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            with candidates as (
                select id
                from admin_notifications
                where created_at < :cutoff
                order by created_at, id
                limit :batchSize
                for update skip locked
            )
            delete from admin_notifications notification
            using candidates
            where notification.id = candidates.id
            """, nativeQuery = true)
    int deleteOlderThanBatch(
            @Param("cutoff") Instant cutoff,
            @Param("batchSize") int batchSize);
}
