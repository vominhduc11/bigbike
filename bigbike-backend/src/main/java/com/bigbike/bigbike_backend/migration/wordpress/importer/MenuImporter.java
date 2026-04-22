package com.bigbike.bigbike_backend.migration.wordpress.importer;

import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressMenuMapper.MappedMenu;
import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressMenuMapper.MappedMenuItem;
import com.bigbike.bigbike_backend.migration.wordpress.writeplan.MigrationDomain;
import com.bigbike.bigbike_backend.persistence.entity.menu.MenuEntity;
import com.bigbike.bigbike_backend.persistence.entity.menu.MenuItemEntity;
import com.bigbike.bigbike_backend.persistence.repository.menu.MenuItemJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.menu.MenuJpaRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class MenuImporter implements DomainImporter {

    private final MenuJpaRepository menuRepo;
    private final MenuItemJpaRepository menuItemRepo;

    public MenuImporter(MenuJpaRepository menuRepo, MenuItemJpaRepository menuItemRepo) {
        this.menuRepo = menuRepo;
        this.menuItemRepo = menuItemRepo;
    }

    @Override
    public MigrationDomain domain() {
        return MigrationDomain.MENUS;
    }

    @Override
    public MigrationExecutionReport.DomainResult execute(MigrationExecutionOptions options) {
        throw new UnsupportedOperationException("Use importBatch()");
    }

    @Transactional
    public MigrationExecutionReport.DomainResult importBatch(
            List<MappedMenu> menus, MigrationExecutionOptions options) {

        int inserted = 0, updated = 0, skipped = 0, failed = 0;
        List<String> warnings = new ArrayList<>();
        List<String> errors = new ArrayList<>();

        for (MappedMenu mm : menus) {
            if (mm.location() == null || mm.location().isBlank()) {
                skipped++;
                continue;
            }
            try {
                Optional<MenuEntity> existing = menuRepo.findByLocation(mm.location());
                MenuEntity menuEntity;
                boolean isNew;
                if (existing.isPresent()) {
                    menuEntity = existing.get();
                    isNew = false;
                } else {
                    menuEntity = new MenuEntity();
                    menuEntity.setCreatedAt(Instant.now());
                    isNew = true;
                }
                menuEntity.setLocation(mm.location());
                menuEntity.setName(mm.name() != null ? mm.name() : mm.location());
                menuEntity.setStatus("ACTIVE");
                menuEntity.setUpdatedAt(Instant.now());

                if (!options.dryRun()) {
                    menuEntity = menuRepo.save(menuEntity);
                }
                if (isNew) inserted++; else updated++;

                // ── Import menu items ─────────────────────────────────────────
                if (!options.dryRun() && mm.items() != null) {
                    importMenuItems(menuEntity, mm.items(), warnings, errors, options);
                }

            } catch (Exception e) {
                failed++;
                errors.add("Menu location=" + mm.location() + ": " + e.getMessage());
                if (options.failFast()) throw new RuntimeException(errors.get(errors.size() - 1), e);
            }
        }
        return new MigrationExecutionReport.DomainResult(
                MigrationDomain.MENUS, inserted, updated, skipped, failed, warnings, errors);
    }

    private void importMenuItems(
            MenuEntity menu,
            List<MappedMenuItem> items,
            List<String> warnings,
            List<String> errors,
            MigrationExecutionOptions options) {

        List<MenuItemEntity> existingItems = menuItemRepo.findByMenuId(menu.getId());
        // Build legacyId → existing entity map
        Map<Long, MenuItemEntity> byLegacyId = new HashMap<>();
        for (MenuItemEntity e : existingItems) {
            if (e.getLegacyId() != null) byLegacyId.put(e.getLegacyId(), e);
        }
        // First pass: save all items (without parent resolution)
        Map<Long, UUID> sourceIdToEntityId = new HashMap<>();
        for (MappedMenuItem mi : items) {
            warnings.addAll(mi.warnings());
            MenuItemEntity entity;
            if (byLegacyId.containsKey(mi.sourceId())) {
                entity = byLegacyId.get(mi.sourceId());
            } else {
                entity = new MenuItemEntity();
                entity.setCreatedAt(Instant.now());
            }
            entity.setMenu(menu);
            entity.setLabel(mi.label() != null ? mi.label() : "");
            entity.setUrl(mi.url());
            entity.setSortOrder(mi.sortOrder());
            entity.setOpenInNewTab(mi.openInNewTab());
            entity.setCssClass(mi.cssClass());
            entity.setStatus("ACTIVE");
            entity.setLegacyId(mi.sourceId());
            entity.setUpdatedAt(Instant.now());
            // Parent resolved in second pass
            entity = menuItemRepo.save(entity);
            sourceIdToEntityId.put(mi.sourceId(), entity.getId());
        }
        // Second pass: resolve parent IDs
        for (MappedMenuItem mi : items) {
            if (mi.parentSourceId() == null) continue;
            UUID parentEntityId = sourceIdToEntityId.get(mi.parentSourceId());
            if (parentEntityId == null) continue;
            MenuItemEntity entity;
            UUID myId = sourceIdToEntityId.get(mi.sourceId());
            entity = myId != null ? menuItemRepo.findById(myId).orElse(null) : null;
            if (entity != null) {
                entity.setParentId(parentEntityId);
                menuItemRepo.save(entity);
            }
        }
    }
}
