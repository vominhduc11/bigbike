package com.bigbike.bigbike_backend.persistence.repository.auth;

import com.bigbike.bigbike_backend.persistence.entity.auth.AdminRoleEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AdminRoleJpaRepository extends JpaRepository<AdminRoleEntity, String> {
}
