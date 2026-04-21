package com.bigbike.bigbike_backend.persistence.repository.auth;

import com.bigbike.bigbike_backend.persistence.entity.auth.AdminRefreshTokenEntity;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;

public interface AdminRefreshTokenJpaRepository extends JpaRepository<AdminRefreshTokenEntity, UUID> {

    Optional<AdminRefreshTokenEntity> findByTokenHash(String tokenHash);

    @Transactional
    @Modifying
    @Query("DELETE FROM AdminRefreshTokenEntity t WHERE t.adminUserId = :userId")
    void deleteAllByAdminUserId(UUID userId);

    @Transactional
    @Modifying
    @Query("DELETE FROM AdminRefreshTokenEntity t WHERE t.expiresAt < :before")
    void deleteExpiredBefore(Instant before);
}
