package com.bigbike.bigbike_backend.persistence.repository.menu;

import com.bigbike.bigbike_backend.persistence.entity.menu.MenuEntity;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MenuJpaRepository extends JpaRepository<MenuEntity, UUID> {

    Optional<MenuEntity> findByLocation(String location);
}
