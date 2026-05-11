package com.bigbike.bigbike_backend.persistence.repository.admin;

import com.bigbike.bigbike_backend.persistence.entity.admin.AdminNotificationEntity;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AdminNotificationJpaRepository extends JpaRepository<AdminNotificationEntity, UUID> {

    List<AdminNotificationEntity> findByReadFalseOrderByCreatedAtDesc(Pageable pageable);

    long countByReadFalse();

    @Modifying
    @Query("UPDATE AdminNotificationEntity n SET n.read = true WHERE n.id IN :ids")
    int markReadByIds(@Param("ids") List<UUID> ids);

    @Modifying
    @Query("UPDATE AdminNotificationEntity n SET n.read = true WHERE n.read = false")
    int markAllRead();
}
