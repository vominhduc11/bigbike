package com.bigbike.bigbike_backend.persistence.repository.auth;

import com.bigbike.bigbike_backend.persistence.entity.auth.AdminInviteTokenEntity;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

public interface AdminInviteTokenJpaRepository extends JpaRepository<AdminInviteTokenEntity, UUID> {

    Optional<AdminInviteTokenEntity> findByTokenHash(String tokenHash);

    @Transactional
    void deleteByAdminUserId(UUID adminUserId);
}
