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
import com.bigbike.bigbike_backend.service.web.WebRevalidationService;
import com.bigbike.bigbike_backend.service.common.PageResult;
import com.bigbike.bigbike_backend.service.common.PaginationService;
import java.time.Instant;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminMenuService {

    private static final int DEFAULT_SIZE = 20;
    private static final int MAX_SIZE = 100;
    private static final Set<String> ALLOWED_MENU_STATUSES = Set.of("ACTIVE", "INACTIVE");
    private static final Set<String> ALLOWED_ITEM_STATUSES = Set.of("ACTIVE", "INACTIVE");

    private final MenuJpaRepository menuRepo;
    private final MenuItemJpaRepository menuItemRepo;
    private final AuditLogJpaRepository auditLogRepo;
    private final PaginationService paginationService;
    private final WebRevalidationService webRevalidationService;

    public AdminMenuService(
            MenuJpaRepository menuRepo,
            MenuItemJpaRepository menuItemRepo,
            AuditLogJpaRepository auditLogRepo,
            PaginationService paginationService,
            WebRevalidationService webRevalidationService
    ) {
        this.menuRepo = menuRepo;
        this.menuItemRepo = menuItemRepo;
        this.auditLogRepo = auditLogRepo;
        this.paginationService = paginationService;
        this.webRevalidationService = webRevalidationService;
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

        String statusStr = req.status() != null ? req.status().trim().toUpperCase(Locale.ROOT) : "ACTIVE";
        if (!ALLOWED_MENU_STATUSES.contains(statusStr)) {
            throw ValidationException.fromField("status", "INVALID",
                    "Menu status must be ACTIVE or INACTIVE.");
        }

        Instant now = Instant.now();
        MenuEntity entity = new MenuEntity();
        entity.setLocation(req.location().trim());
        entity.setName(req.name().trim());
        entity.setStatus(statusStr);
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        entity = menuRepo.save(entity);

        webRevalidationService.revalidate("menus");
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
            String statusStr = req.status().trim().toUpperCase(Locale.ROOT);
            if (!ALLOWED_MENU_STATUSES.contains(statusStr)) {
                throw ValidationException.fromField("status", "INVALID",
                        "Menu status must be ACTIVE or INACTIVE.");
            }
            entity.setStatus(statusStr);
        }
        entity.setUpdatedAt(Instant.now());
        menuRepo.save(entity);

        webRevalidationService.revalidate("menus");
        auditLogRepo.save(buildMenuAudit(adminId, "MENU_UPDATED", menuId, before, menuSnapshot(entity)));

        return toMenuResponse(entity, menuItemRepo.findByMenuIdOrderBySortOrderAsc(menuId));
    }

    // ── Delete menu ───────────────────────────────────────────────────────────

    @Transactional
    public void deleteMenu(UUID menuId, UUID adminId) {
        MenuEntity entity = menuRepo.findById(menuId)
                .orElseThrow(() -> new NotFoundException("Menu not found."));

        String before = menuSnapshot(entity);
        // DB ON DELETE CASCADE on menu_id handles item deletion (including deep hierarchies)
        menuRepo.delete(entity);

        webRevalidationService.revalidate("menus");
        auditLogRepo.save(buildMenuAudit(adminId, "MENU_DELETED", menuId, before, null));
    }

    // ── Create menu item ──────────────────────────────────────────────────────

    @Transactional
    public AdminMenuItemResponse createMenuItem(UUID menuId, UUID adminId, CreateMenuItemRequest req) {
        MenuEntity menu = menuRepo.findById(menuId)
                .orElseThrow(() -> new NotFoundException("Menu not found."));

        String statusStr = req.status() != null ? req.status().trim().toUpperCase(Locale.ROOT) : "ACTIVE";
        if (!ALLOWED_ITEM_STATUSES.contains(statusStr)) {
            throw ValidationException.fromField("status", "INVALID",
                    "Menu item status must be ACTIVE or INACTIVE.");
        }

        // Parent validation: must exist in same menu; new items can't create cycles
        if (req.parentId() != null) {
            List<MenuItemEntity> allItems = menuItemRepo.findByMenuId(menuId);
            validateParentBelongsToMenu(allItems, req.parentId(), menuId);
            // No cycle possible for a new item (it has no ID yet)
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
        item.setStatus(statusStr);
        item.setCreatedAt(now);
        item.setUpdatedAt(now);
        item = menuItemRepo.save(item);

        webRevalidationService.revalidate("menus");
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

        if (Boolean.TRUE.equals(req.clearParentId())) {
            item.setParentId(null);
        } else if (req.parentId() != null) {
            List<MenuItemEntity> allItems = menuItemRepo.findByMenuId(menuId);
            validateParentBelongsToMenu(allItems, req.parentId(), menuId);
            validateNoDeepCycle(allItems, itemId, req.parentId());
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
            if ("CUSTOM".equalsIgnoreCase(req.targetType())) {
                item.setTargetId(null);
            }
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
            String statusStr = req.status().trim().toUpperCase(Locale.ROOT);
            if (!ALLOWED_ITEM_STATUSES.contains(statusStr)) {
                throw ValidationException.fromField("status", "INVALID",
                        "Menu item status must be ACTIVE or INACTIVE.");
            }
            item.setStatus(statusStr);
        }
        item.setUpdatedAt(Instant.now());
        menuItemRepo.save(item);

        webRevalidationService.revalidate("menus");
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

        List<MenuItemEntity> allItems = menuItemRepo.findByMenuId(menuId);
        boolean hasChildren = allItems.stream().anyMatch(i -> itemId.equals(i.getParentId()));
        if (hasChildren) {
            throw new ConflictException("Cannot delete menu item: it has child items (CHILD_ITEMS_EXIST).");
        }

        String before = itemSnapshot(item);
        menuItemRepo.delete(item);

        webRevalidationService.revalidate("menus");
        auditLogRepo.save(buildItemAudit(adminId, "MENU_ITEM_DELETED", itemId, before, null));
    }

    // ── Reorder items ─────────────────────────────────────────────────────────

    @Transactional
    public AdminMenuResponse reorderItems(UUID menuId, UUID adminId, ReorderMenuItemsRequest req) {
        MenuEntity menu = menuRepo.findById(menuId)
                .orElseThrow(() -> new NotFoundException("Menu not found."));

        List<MenuItemEntity> existingItems = menuItemRepo.findByMenuId(menuId);
        Set<UUID> menuItemIds = existingItems.stream()
                .map(MenuItemEntity::getId)
                .collect(Collectors.toSet());

        // Build the proposed parent map: start from existing, then apply request overrides
        Map<UUID, UUID> proposedParentMap = new HashMap<>();
        for (MenuItemEntity item : existingItems) {
            proposedParentMap.put(item.getId(), item.getParentId());
        }

        // Validate each reorder entry and build proposed map
        for (ReorderMenuItemRequest r : req.items()) {
            if (!menuItemIds.contains(r.id())) {
                throw new NotFoundException("Menu item not found in this menu: " + r.id());
            }
            if (r.parentId() != null) {
                if (!menuItemIds.contains(r.parentId())) {
                    throw ValidationException.fromField("parentId", "WRONG_MENU",
                            "Parent item " + r.parentId() + " does not belong to this menu.");
                }
                if (r.parentId().equals(r.id())) {
                    throw ValidationException.fromField("parentId", "CYCLE",
                            "An item cannot be its own parent.");
                }
            }
            proposedParentMap.put(r.id(), r.parentId());
        }

        // Deep cycle detection across all reordered items
        for (ReorderMenuItemRequest r : req.items()) {
            if (r.parentId() != null) {
                detectCycleInMap(proposedParentMap, r.id());
            }
        }

        // Apply changes
        for (ReorderMenuItemRequest r : req.items()) {
            MenuItemEntity found = existingItems.stream()
                    .filter(i -> i.getId().equals(r.id()))
                    .findFirst()
                    .orElseThrow();
            found.setParentId(r.parentId());
            found.setSortOrder(r.sortOrder());
            found.setUpdatedAt(Instant.now());
        }
        menuItemRepo.saveAll(existingItems);

        webRevalidationService.revalidate("menus");
        auditLogRepo.save(buildMenuAudit(adminId, "MENU_ITEMS_REORDERED", menuId, null,
                "{\"itemCount\":" + req.items().size() + "}"));

        return toMenuResponse(menu, menuItemRepo.findByMenuIdOrderBySortOrderAsc(menuId));
    }

    // ── Public menu ───────────────────────────────────────────────────────────

    public PublicMenuResponse getPublicMenuByLocation(String location) {
        MenuEntity menu = menuRepo.findByLocation(location)
                .orElseThrow(() -> new NotFoundException("Menu not found for location: " + location));

        // INACTIVE menus are not publicly visible
        if (!"ACTIVE".equalsIgnoreCase(menu.getStatus())) {
            throw new NotFoundException("Menu not found for location: " + location);
        }

        List<MenuItemEntity> allItems = menuItemRepo.findByMenuIdOrderBySortOrderAsc(menu.getId());

        // Build active-item index for ancestor chain check
        Map<UUID, MenuItemEntity> activeById = allItems.stream()
                .filter(i -> "ACTIVE".equalsIgnoreCase(i.getStatus()))
                .collect(Collectors.toMap(MenuItemEntity::getId, i -> i));

        List<PublicMenuItemResponse> items = activeById.values().stream()
                .filter(i -> isAncestorChainActive(i, activeById))
                .sorted(Comparator.comparingInt(MenuItemEntity::getSortOrder))
                .map(i -> new PublicMenuItemResponse(
                        i.getId(), i.getParentId(), i.getLabel(), i.getUrl(),
                        i.getSortOrder(), i.isOpenInNewTab(), i.getCssClass()))
                .toList();

        return new PublicMenuResponse(menu.getLocation(), menu.getName(), items);
    }

    private static boolean isAncestorChainActive(MenuItemEntity item, Map<UUID, MenuItemEntity> activeById) {
        UUID parentId = item.getParentId();
        while (parentId != null) {
            MenuItemEntity parent = activeById.get(parentId);
            if (parent == null) return false;
            parentId = parent.getParentId();
        }
        return true;
    }

    // ── Validation ────────────────────────────────────────────────────────────

    private void validateParentBelongsToMenu(List<MenuItemEntity> allItems, UUID parentId, UUID menuId) {
        boolean exists = allItems.stream().anyMatch(i -> i.getId().equals(parentId));
        if (!exists) {
            throw ValidationException.fromField("parentId", "NOT_FOUND",
                    "Parent menu item not found.");
        }
    }

    /**
     * Detects if setting itemId's parent to parentId would create a deep cycle.
     * Walks upward from parentId using existing parent assignments; if itemId is
     * encountered, the new relationship would form a cycle.
     */
    private void validateNoDeepCycle(List<MenuItemEntity> allItems, UUID itemId, UUID parentId) {
        // Self-parent check
        if (parentId.equals(itemId)) {
            throw ValidationException.fromField("parentId", "CYCLE",
                    "An item cannot be its own parent.");
        }

        // Build map of current parents (excluding the item being moved, so we use the proposed edge)
        Map<UUID, UUID> parentMap = allItems.stream()
                .filter(i -> i.getParentId() != null && !i.getId().equals(itemId))
                .collect(Collectors.toMap(MenuItemEntity::getId, MenuItemEntity::getParentId, (a, b) -> a));
        // Add the proposed edge
        parentMap.put(itemId, parentId);

        // Walk from parentId upward; if we reach itemId, it's a cycle
        Set<UUID> visited = new HashSet<>();
        UUID current = parentId;
        while (current != null && !visited.contains(current)) {
            if (current.equals(itemId)) {
                throw ValidationException.fromField("parentId", "CYCLE",
                        "Setting this parent would create a cycle in the menu hierarchy.");
            }
            visited.add(current);
            current = parentMap.get(current);
        }
    }

    /**
     * Given a proposed parent map (itemId → parentId), checks that following
     * the chain from `startItemId` does not loop back to itself.
     */
    private void detectCycleInMap(Map<UUID, UUID> parentMap, UUID startItemId) {
        Set<UUID> visited = new HashSet<>();
        UUID current = parentMap.get(startItemId); // start from proposed parent
        while (current != null) {
            if (current.equals(startItemId)) {
                throw ValidationException.fromField("parentId", "CYCLE",
                        "Reorder would create a cycle in the menu hierarchy.");
            }
            if (visited.contains(current)) break; // pre-existing cycle guard
            visited.add(current);
            current = parentMap.get(current);
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
