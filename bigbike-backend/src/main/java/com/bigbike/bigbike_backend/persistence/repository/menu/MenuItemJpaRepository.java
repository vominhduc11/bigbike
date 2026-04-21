package com.bigbike.bigbike_backend.persistence.repository.menu;

import com.bigbike.bigbike_backend.persistence.entity.menu.MenuItemEntity;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MenuItemJpaRepository extends JpaRepository<MenuItemEntity, UUID> {

    List<MenuItemEntity> findByMenuId(UUID menuId);

    List<MenuItemEntity> findByMenuIdOrderBySortOrderAsc(UUID menuId);
}
