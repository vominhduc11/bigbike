package com.bigbike.bigbike_backend.persistence.repository.admin;

import com.bigbike.bigbike_backend.persistence.entity.admin.AdminNotificationReadEntity;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AdminNotificationReadJpaRepository
        extends JpaRepository<AdminNotificationReadEntity, UUID> {
}
