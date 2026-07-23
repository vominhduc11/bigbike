package com.bigbike.bigbike_backend.persistence.repository.auth;

import com.bigbike.bigbike_backend.persistence.entity.auth.AdminUserEntity;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AdminUserJpaRepository extends JpaRepository<AdminUserEntity, UUID> {

    Optional<AdminUserEntity> findByEmail(String email);

    long countByRole(String role);

    @Query("SELECT u.role, COUNT(u) FROM AdminUserEntity u "
            + "WHERE u.status IN :statuses GROUP BY u.role")
    List<Object[]> countAssignedUsersByRoleAndStatusIn(@Param("statuses") Collection<String> statuses);

    // RBAUD-008: targeted count for SUPER_ADMIN guard — avoids full table scan via findAll()
    long countByRoleAndStatus(String role, String status);
}
