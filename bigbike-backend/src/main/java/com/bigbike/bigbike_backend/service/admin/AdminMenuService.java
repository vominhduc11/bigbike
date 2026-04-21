package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.menu.AdminMenuItemResponse;
import com.bigbike.bigbike_backend.api.admin.dto.menu.AdminMenuResponse;
import com.bigbike.bigbike_backend.api.admin.dto.menu.CreateMenuItemRequest;
import com.bigbike.bigbike_backend.api.admin.dto.menu.CreateMenuRequest;
import com.bigbike.bigbike_backend.api.admin.dto.menu.PublicMenuItemResponse;
import com.bigbike.bigbike_backend.api.admin.dto.menu.PublicMenuResponse;
import com.bigbike.bigbike_backend.api.admin.dto.menu.ReorderMenuItemRequest;
import com.bigbike.bigbike_backend.api.admin.dto.menu.ReorderMenuItemsRequest;
import com.bigbike.bigbike_backend.api.admin.dto.menu.UpdateMenuItemRequest;
import com.bigbike.bigbike_backend.api.admin.dto.menu.UpdateMenuRequest;
import com.bigbike.bigbike_backend.api.error.ConflictException;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.persistence.entity.audit.AuditLogEntity;
import com.bigbike.bigbike_backend.persistence.entity.menu.MenuEntity;
import com.bigbike.bigbike_backend.persistence.entity.menu.MenuItemEntity;
import com.bigbike.bigbike_backend.persistence.repository.audit.AuditLogJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.menu.MenuItemJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.menu.MenuJpaRepository;
import com.bigbike.bigbike_backend.service.common.PageResult;
import com.bigbike.bigbike_backend.service.common.PaginationService;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.stream.Stream;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminMenuService {

    private static final int DEFAULT_SIZE = 20;
    private static final int MAX_SIZE = 100;

    private final MenuJpaRepository menuRepo;
    private final MenuItemJpaRepository menuItemRepo;
    private final AuditLogJpaRepository auditLogRepo;
    private final PaginationService paginationService;

    public AdminMenuService(
            MenuJpaRepository menuRepo,
            MenuItemJpaRepository menuItemRepo,
            AuditLogJpaRepository auditLogRepo,
            PaginationService paginationService
    ) {
        this.menuRepo = menuRepo;
        this.menuItemRepo = menuItemRepo;
        this.auditLogRepo = auditLogRepo;
        this.paginationService = paginationService;
    }

    // ── List menus ────────────────────────────────────────────────────────────

    public PageResult<AdminMenuResponse> listMenus(int page, int size, String q, String status) {
        int normalizedPage = Math.max(1, page);
        int normalizedSize = (size <= 0) ? DEFAULT_SIZE : Math.min(size, MAX_SIZE);

        Stream<MenuEntity> stream = menuRepo.findAll().stream();

        if (q != null && !q.isBlank()) {
            String qLower = q.toLowerCase(Locale.ROOT);
            stream = stream.filter(m ->
                    matchesQ(m.getLocation(), qLower) || matchesQ(m.getName(), qLower));
        }
        if (status != null && !status.isBlank()) {
            stream = stream.filter(m -> status.equalsIgnoreCase(m.getStatus()));
        }

        List<AdminMenuResponse> items = stream
                .sorted(Comparator.comparing(MenuEntity::getCreatedAt, Comparator.reverseOrder()))
                .map(m -> toMenuResponse(m, menuItemRepo.findByMenuIdOrderBySortOrderAsc(m.getId())))
                .toList();

        return paginationService.paginate(items, normalizedPage, normalizedSize);
    }

    // ── Get menu by id ────────────────────────────────────────────────────────

    public AdminMenuResponse getMenuById(UUID menuId) {
        MenuEntity menu = menuRepo.findById(menuId)
                .orElseThrow(() -> new NotFoundException("Menu not found."));
        return toMenuResponse(menu, menuItemRepo.findByMenuIdOrderBySortOrderAsc(menuId));
    }

    // ── Get menu by location ──────────────────────────────────────────────────

    public AdminMenuResponse getMenuByLocation(String location) {
        MenuEntity menu = menuRepo.findByLocation(location)
                .orElseThrow(() -> new NotFoundException("Menu not found for location: " + location));
        return toMenuResponse(menu, menuItemRepo.findByMenuIdOrderBySortOrderAsc(menu.getId()));
    }

    // ── Create menu ───────────────────────────────────────────────────────────

    @Transactional
    public AdminMenuResponse createMenu(UUID adminId, CreateMenuRequest req) {
        menuRepo.findByLocation(req.location()).ifPresent(existing -> {
            throw new ConflictException("A menu at location '" + req.location() + "' already exists.");
        });

        Instant now = Instant.now();
        MenuEntity entity = new MenuEntity();
        entity.setLocation(req.location().trim());
        entity.setName(req.name().trim());
        entity.setStatus(req.status() != null ? req.status().toUpperCase(Locale.ROOT) : "ACTIVE");
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        entity = menuRepo.save(entity);

        auditLogRepo.save(buildMenuAudit(adminId, "MENU_CREATED", entity.getId(), null,
                "{\"location\":\"" + escapeJson(entity.getLocation()) + "\",\"name\":\"" + escapeJson(entity.getName()) + "\"}"));

        return toMenuResponse(entity, List.of());
    }

    // ── Update menu ───────────────────────────────────────────────────────────

    @Transactional
    public AdminMenuResponse updateMenu(UUID menuId, UUID adminId, UpdateMenuRequest req) {
        MenuEntity entity = menuRepo.findById(menuId)
                .orElseThrow(() -> new NotFoundException("Menu not found."));

        String before = menuSnapshot(entity);

        if (req.name() != null && !req.name().isBlank()) {
            entity.setName(req.name().trim());
        }
        if (req.status() != null && !req.status().isBlank()) {
            entity.setStatus(req.status().toUpperCase(Locale.ROOT));
        }
        entity.setUpdatedAt(Instant.now());
        menuRepo.save(entity);

        auditLogRepo.save(buildMenuAudit(adminId, "MENU_UPDATED", menuId, before, menuSnapshot(entity)));

        return toMenuResponse(entity, menuItemRepo.findByMenuIdOrderBySortOrderAsc(menuId));
    }

    // ── Delete menu ───────────────────────────────────────────────────────────

    @Transactional
    public void deleteMenu(UUID menuId, UUID adminId) {
        MenuEntity entity = menuRepo.findById(menuId)
                .orElseThrow(() -> new NotFoundException("Menu not found."));

        String before = menuSnapshot(entity);
        // Physical delete of items then menu
        List<MenuItemEntity> items = menuItemRepo.findByMenuId(menuId);
        menuItemRepo.deleteAll(items);
        menuRepo.delete(entity);

        auditLogRepo.save(buildMenuAudit(adminId, "MENU_DELETED", menuId, before, null));
    }

    // ── Create menu item ──────────────────────────────────────────────────────

    @Transactional
    public AdminMenuItemResponse createMenuItem(UUID menuId, UUID adminId, CreateMenuItemRequest req) {
        MenuEntity menu = menuRepo.findById(menuId)
                .orElseThrow(() -> new NotFoundException("Menu not found."));

        // Parent cycle prevention: parent must belong to same menu and must not be a cycle
        if (req.parentId() != null) {
            validateParent(menuId, req.parentId(), null);
        }

        Instant now = Instant.now();
        MenuItemEntity item = new MenuItemEntity();
        item.setMenu(menu);
        item.setParentId(req.parentId());
        item.setLabel(req.label().trim());
        item.setUrl(req.url());
        item.setTargetType(req.targetType());
        item.setTargetId(req.targetId());
        item.setSortOrder(req.sortOrder() != null ? req.sortOrder() : 0);
        item.setOpenInNewTab(req.openInNewTab() != null && req.openInNewTab());
        item.setCssClass(req.cssClass());
        item.setStatus(req.status() != null ? req.status().toUpperCase(Locale.ROOT) : "ACTIVE");
        item.setCreatedAt(now);
        item.setUpdatedAt(now);
        item = menuItemRepo.save(item);

        auditLogRepo.save(buildItemAudit(adminId, "MENU_ITEM_CREATED", item.getId(), null,
                "{\"label\":\"" + escapeJson(item.getLabel()) + "\",\"menuId\":\"" + menuId + "\"}"));

        return toItemResponse(item);
    }

    // ── Update menu item ──────────────────────────────────────────────────────

    @Transactional
    public AdminMenuItemResponse updateMenuItem(UUID menuId, UUID itemId, UUID adminId, UpdateMenuItemRequest req) {
        menuRepo.findById(menuId)
                .orElseThrow(() -> new NotFoundException("Menu not found."));
        MenuItemEntity item = menuItemRepo.findById(itemId)
                .orElseThrow(() -> new NotFoundException("Menu item not found."));

        if (!item.getMenu().getId().equals(menuId)) {
            throw new NotFoundException("Menu item not found.");
        }

        String before = itemSnapshot(item);

        if (req.parentId() != null) {
            validateParent(menuId, req.parentId(), itemId);
            item.setParentId(req.parentId());
        }
        if (req.label() != null && !req.label().isBlank()) {
            item.setLabel(req.label().trim());
        }
        if (req.url() != null) {
            item.setUrl(req.url());
        }
        if (req.targetType() != null) {
            item.setTargetType(req.targetType());
        }
        if (req.targetId() != null) {
            item.setTargetId(req.targetId());
        }
        if (req.sortOrder() != null) {
            item.setSortOrder(req.sortOrder());
        }
        if (req.openInNewTab() != null) {
            item.setOpenInNewTab(req.openInNewTab());
        }
        if (req.cssClass() != null) {
            item.setCssClass(req.cssClass());
        }
        if (req.status() != null && !req.status().isBlank()) {
            item.setStatus(req.status().toUpperCase(Locale.ROOT));
        }
        item.setUpdatedAt(Instant.now());
        menuItemRepo.save(item);

        auditLogRepo.save(buildItemAudit(adminId, "MENU_ITEM_UPDATED", itemId, before, itemSnapshot(item)));

        return toItemResponse(item);
    }

    // ── Delete menu item (physical) ───────────────────────────────────────────

    @Transactional
    public void deleteMenuItem(UUID menuId, UUID itemId, UUID adminId) {
        menuRepo.findById(menuId)
                .orElseThrow(() -> new NotFoundException("Menu not found."));
        MenuItemEntity item = menuItemRepo.findById(itemId)
                .orElseThrow(() -> new NotFoundException("Menu item not found."));

        if (!item.getMenu().getId().equals(menuId)) {
            throw new NotFoundException("Menu item not found.");
        }

        String before = itemSnapshot(item);
        menuItemRepo.delete(item);

        auditLogRepo.save(buildItemAudit(adminId, "MENU_ITEM_DELETED", itemId, before, null));
    }

    // ── Reorder items ─────────────────────────────────────────────────────────

    @Transactional
    public AdminMenuResponse reorderItems(UUID menuId, UUID adminId, ReorderMenuItemsRequest req) {
        MenuEntity menu = menuRepo.findById(menuId)
                .orElseThrow(() -> new NotFoundException("Menu not found."));

        List<MenuItemEntity> existingItems = menuItemRepo.findByMenuId(menuId);

        for (ReorderMenuItemRequest r : req.items()) {
            MenuItemEntity found = existingItems.stream()
                    .filter(i -> i.getId().equals(r.id()))
                    .findFirst()
                    .orElseThrow(() -> new NotFoundException("Menu item not found: " + r.id()));
            found.setParentId(r.parentId());
            found.setSortOrder(r.sortOrder());
            found.setUpdatedAt(Instant.now());
        }
        menuItemRepo.saveAll(existingItems);

        auditLogRepo.save(buildMenuAudit(adminId, "MENU_ITEMS_REORDERED", menuId, null,
                "{\"itemCount\":" + req.items().size() + "}"));

        return toMenuResponse(menu, menuItemRepo.findByMenuIdOrderBySortOrderAsc(menuId));
    }

    // ── Public menu ───────────────────────────────────────────────────────────

    public PublicMenuResponse getPublicMenuByLocation(String location) {
        MenuEntity menu = menuRepo.findByLocation(location)
                .orElseThrow(() -> new NotFoundException("Menu not found for location: " + location));

        List<PublicMenuItemResponse> items = menuItemRepo.findByMenuIdOrderBySortOrderAsc(menu.getId()).stream()
                .filter(i -> "ACTIVE".equalsIgnoreCase(i.getStatus()))
                .map(i -> new PublicMenuItemResponse(
                        i.getId(), i.getParentId(), i.getLabel(), i.getUrl(),
                        i.getSortOrder(), i.isOpenInNewTab(), i.getCssClass()))
                .toList();

        return new PublicMenuResponse(menu.getLocation(), menu.getName(), items);
    }

    // ── Validation ────────────────────────────────────────────────────────────

    private void validateParent(UUID menuId, UUID parentId, UUID excludeItemId) {
        MenuItemEntity parent = menuItemRepo.findById(parentId)
                .orElseThrow(() -> ValidationException.fromField("parentId", "NOT_FOUND",
                        "Parent menu item not found."));
        if (!parent.getMenu().getId().equals(menuId)) {
            throw ValidationException.fromField("parentId", "WRONG_MENU",
                    "Parent menu item does not belong to this menu.");
        }
        // Cycle check: parent must not be excludeItemId itself
        if (excludeItemId != null && parentId.equals(excludeItemId)) {
            throw ValidationException.fromField("parentId", "CYCLE",
                    "An item cannot be its own parent.");
        }
    }

    // ── Mapping ───────────────────────────────────────────────────────────────

    private AdminMenuResponse toMenuResponse(MenuEntity m, List<MenuItemEntity> items) {
        return new AdminMenuResponse(
                m.getId(), m.getLocation(), m.getName(), m.getStatus(),
                m.getCreatedAt(), m.getUpdatedAt(),
                items.stream().map(this::toItemResponse).toList()
        );
    }

    private AdminMenuItemResponse toItemResponse(MenuItemEntity i) {
        return new AdminMenuItemResponse(
                i.getId(), i.getMenu().getId(), i.getParentId(),
                i.getLabel(), i.getUrl(), i.getTargetType(), i.getTargetId(),
                i.getSortOrder(), i.isOpenInNewTab(), i.getCssClass(),
                i.getStatus(), i.getCreatedAt(), i.getUpdatedAt()
        );
    }

    // ── Audit helpers ─────────────────────────────────────────────────────────

    private AuditLogEntity buildMenuAudit(UUID adminId, String action, UUID resourceId,
            String before, String after) {
        AuditLogEntity log = new AuditLogEntity();
        log.setActorType("ADMIN");
        log.setActorId(adminId);
        log.setAction(action);
        log.setResourceType("MENU");
        log.setResourceId(resourceId);
        log.setBeforeData(before);
        log.setAfterData(after);
        log.setCreatedAt(Instant.now());
        return log;
    }

    private AuditLogEntity buildItemAudit(UUID adminId, String action, UUID resourceId,
            String before, String after) {
        AuditLogEntity log = new AuditLogEntity();
        log.setActorType("ADMIN");
        log.setActorId(adminId);
        log.setAction(action);
        log.setResourceType("MENU_ITEM");
        log.setResourceId(resourceId);
        log.setBeforeData(before);
        log.setAfterData(after);
        log.setCreatedAt(Instant.now());
        return log;
    }

    private static String menuSnapshot(MenuEntity m) {
        return "{\"location\":\"" + escapeJson(m.getLocation()) +
               "\",\"name\":\"" + escapeJson(m.getName()) +
               "\",\"status\":\"" + m.getStatus() + "\"}";
    }

    private static String itemSnapshot(MenuItemEntity i) {
        return "{\"label\":\"" + escapeJson(i.getLabel()) +
               "\",\"sortOrder\":" + i.getSortOrder() +
               ",\"status\":\"" + i.getStatus() + "\"}";
    }

    private static boolean matchesQ(String field, String qLower) {
        return field != null && field.toLowerCase(Locale.ROOT).contains(qLower);
    }

    private static String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
