package com.bigbike.bigbike_backend.persistence.repository.auth;

import com.bigbike.bigbike_backend.persistence.entity.auth.AdminUserEntity;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AdminUserJpaRepository extends JpaRepository<AdminUserEntity, UUID> {

    Optional<AdminUserEntity> findByEmail(String email);

    long countByRole(String role);

    // RBAUD-008: targeted count for SUPER_ADMIN guard — avoids full table scan via findAll()
    long countByRoleAndStatus(String role, String status);
}
