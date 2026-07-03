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
import com.bigbike.bigbike_backend.api.error.ApiException;
import com.bigbike.bigbike_backend.api.error.ConflictException;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.domain.menu.MenuLocations;
import com.bigbike.bigbike_backend.persistence.entity.catalog.CategoryEntity;
import com.bigbike.bigbike_backend.persistence.entity.menu.MenuEntity;
import com.bigbike.bigbike_backend.persistence.entity.menu.MenuItemEntity;
import com.bigbike.bigbike_backend.service.audit.AuditLogWriter;
import com.bigbike.bigbike_backend.persistence.repository.catalog.CategoryJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.menu.MenuItemJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.menu.MenuJpaRepository;
import com.bigbike.bigbike_backend.service.web.WebRevalidationService;
import com.bigbike.bigbike_backend.service.common.PageResult;
import com.bigbike.bigbike_backend.service.common.PaginationService;
import static com.bigbike.bigbike_backend.service.admin.MenuSupport.*;
import java.time.Instant;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AdminMenuService {

    private static final int DEFAULT_SIZE = 20;
    private static final int MAX_SIZE = 100;
    private static final Set<String> ALLOWED_MENU_STATUSES = Set.of("ACTIVE", "INACTIVE");
    private static final Set<String> ALLOWED_ITEM_STATUSES = Set.of("ACTIVE", "INACTIVE");

    // Icon line đơn sắc của mục menu danh mục: resolve từ DB theo slug trong URL mục menu
    // (/danh-muc-san-pham/{slug}) → CategoryEntity.menuIconUrl. Thay cho map slug hard-code cũ
    // (WP-parity) — giờ icon gắn theo danh mục trong DB, không còn phụ thuộc tên slug. Xem V213.
    private static final String CATEGORY_URL_PREFIX = "/danh-muc-san-pham/";

    private String resolveMenuIconUrl(String url) {
        if (url == null || url.isBlank()) return null;
        String path = url.trim();
        int q = path.indexOf('?');
        if (q != -1) path = path.substring(0, q);
        if (!path.startsWith(CATEGORY_URL_PREFIX)) return null;
        String slug = path.substring(CATEGORY_URL_PREFIX.length());
        if (slug.endsWith("/")) slug = slug.substring(0, slug.length() - 1);
        if (slug.isBlank()) return null;
        return categoryRepo.findBySlug(slug.toLowerCase(Locale.ROOT))
                .map(CategoryEntity::getMenuIconUrl)
                .orElse(null);
    }

    // A menu item can link straight to a category (targetType=CATEGORY, targetId=category id)
    // instead of a hand-typed URL. Public read resolves the locale-appropriate slug at request
    // time — see resolveDisplayUrl().
    private void validateCategoryTarget(String targetType, String targetId) {
        if (!"CATEGORY".equalsIgnoreCase(targetType)) return;
        if (targetId == null || categoryRepo.findById(targetId).isEmpty()) {
            throw ValidationException.fromField("targetId", "CATEGORY_NOT_FOUND",
                    "targetId must reference an existing category when targetType is CATEGORY.");
        }
    }

    // Category-linked items resolve their URL dynamically per lang (VI slug vs EN slug) instead
    // of using the stored url column. Falls back to the stored url if the linked category was
    // since deleted, so a stale link never breaks the menu.
    private String resolveDisplayUrl(MenuItemEntity item, String lang) {
        if ("CATEGORY".equalsIgnoreCase(item.getTargetType()) && item.getTargetId() != null) {
            return categoryRepo.findById(item.getTargetId())
                    .map(cat -> CATEGORY_URL_PREFIX + pick(cat.getSlug(), cat.getSlugEn(), lang))
                    .orElse(item.getUrl());
        }
        return item.getUrl();
    }

    private final MenuJpaRepository menuRepo;
    private final MenuItemJpaRepository menuItemRepo;
    private final AuditLogWriter auditLogWriter;
    private final PaginationService paginationService;
    private final WebRevalidationService webRevalidationService;
    private final CategoryJpaRepository categoryRepo;

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
        // Menu containers are system-defined slots — admins can only (re)create
        // one of the whitelisted locations the storefront knows how to render.
        // Anything else would become orphan data.
        String locationStr = req.location() == null ? "" : req.location().trim().toLowerCase(Locale.ROOT);
        if (!MenuLocations.SYSTEM_LOCATIONS.contains(locationStr)) {
            throw ValidationException.fromField("location", "INVALID_MENU_LOCATION",
                    "Menu location must be one of " + MenuLocations.SYSTEM_LOCATIONS + ".");
        }

        menuRepo.findByLocation(locationStr).ifPresent(existing -> {
            throw new ConflictException("A menu at location '" + locationStr + "' already exists.");
        });

        String statusStr = req.status() != null ? req.status().trim().toUpperCase(Locale.ROOT) : "ACTIVE";
        if (!ALLOWED_MENU_STATUSES.contains(statusStr)) {
            throw ValidationException.fromField("status", "INVALID",
                    "Menu status must be ACTIVE or INACTIVE.");
        }

        Instant now = Instant.now();
        MenuEntity entity = new MenuEntity();
        entity.setLocation(locationStr);
        entity.setName(req.name().trim());
        entity.setStatus(statusStr);
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        entity = menuRepo.save(entity);

        webRevalidationService.revalidate("menus");
        auditLogWriter.save(buildMenuAudit(adminId, "MENU_CREATED", entity.getId(), null,
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
        auditLogWriter.save(buildMenuAudit(adminId, "MENU_UPDATED", menuId, before, menuSnapshot(entity)));

        return toMenuResponse(entity, menuItemRepo.findByMenuIdOrderBySortOrderAsc(menuId));
    }

    // ── Delete menu ───────────────────────────────────────────────────────────

    @Transactional
    public void deleteMenu(UUID menuId, UUID adminId) {
        MenuEntity entity = menuRepo.findById(menuId)
                .orElseThrow(() -> new NotFoundException("Menu not found."));

        // System menu slots are required by the storefront. Removing one would
        // leave the public site with an empty header/footer/guide. Admins must
        // empty/disable items instead of dropping the container.
        if (MenuLocations.isSystem(entity.getLocation())) {
            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "SYSTEM_MENU_CANNOT_BE_DELETED",
                    "System menu '" + entity.getLocation() + "' cannot be deleted.",
                    java.util.List.of()
            );
        }

        String before = menuSnapshot(entity);
        List<MenuItemEntity> items = menuItemRepo.findByMenuId(menuId);
        deleteMenuItemsBottomUp(items);
        menuRepo.delete(entity);

        webRevalidationService.revalidate("menus");
        auditLogWriter.save(buildMenuAudit(adminId, "MENU_DELETED", menuId, before, null));
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

        // URL scheme validation — block dangerous/unexpected schemes
        validateMenuItemUrl(req.url());

        // Parent validation: must exist in same menu; new items can't create cycles
        if (req.parentId() != null) {
            List<MenuItemEntity> allItems = menuItemRepo.findByMenuId(menuId);
            validateParentBelongsToMenu(allItems, req.parentId(), menuId);
            // No cycle possible for a new item (it has no ID yet)
        }

        validateCategoryTarget(req.targetType(), req.targetId());

        Instant now = Instant.now();
        MenuItemEntity item = new MenuItemEntity();
        item.setMenu(menu);
        item.setParentId(req.parentId());
        item.setLabel(req.label().trim());
        item.setLabelEn(normalizeOptional(req.labelEn()));
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
        auditLogWriter.save(buildItemAudit(adminId, "MENU_ITEM_CREATED", item.getId(), null,
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
        // Presence-flag: omit labelEn → unchanged; send blank → clears the English label.
        if (req.labelEn() != null) {
            item.setLabelEn(normalizeOptional(req.labelEn()));
        }
        if (req.url() != null) {
            validateMenuItemUrl(req.url());
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
        if (req.targetType() != null || req.targetId() != null) {
            validateCategoryTarget(item.getTargetType(), item.getTargetId());
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
        auditLogWriter.save(buildItemAudit(adminId, "MENU_ITEM_UPDATED", itemId, before, itemSnapshot(item)));

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
        auditLogWriter.save(buildItemAudit(adminId, "MENU_ITEM_DELETED", itemId, before, null));
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
        auditLogWriter.save(buildMenuAudit(adminId, "MENU_ITEMS_REORDERED", menuId, null,
                "{\"itemCount\":" + req.items().size() + "}"));

        return toMenuResponse(menu, menuItemRepo.findByMenuIdOrderBySortOrderAsc(menuId));
    }

    // ── Public menu ───────────────────────────────────────────────────────────

    public PublicMenuResponse getPublicMenuByLocation(String location, String lang) {
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
                        i.getId(), i.getParentId(), pick(i.getLabel(), i.getLabelEn(), lang),
                        resolveDisplayUrl(i, lang),
                        i.getSortOrder(), i.isOpenInNewTab(), i.getCssClass(),
                        resolveMenuIconUrl(i.getUrl())))
                .toList();

        return new PublicMenuResponse(menu.getLocation(), menu.getName(), items);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private void deleteMenuItemsBottomUp(List<MenuItemEntity> items) {
        if (items.isEmpty()) return;
        Set<UUID> isParent = items.stream()
                .map(MenuItemEntity::getParentId)
                .filter(p -> p != null)
                .collect(Collectors.toSet());
        List<MenuItemEntity> leaves = items.stream()
                .filter(i -> !isParent.contains(i.getId()))
                .toList();
        List<MenuItemEntity> parents = items.stream()
                .filter(i -> isParent.contains(i.getId()))
                .toList();
        menuItemRepo.deleteAll(leaves);
        deleteMenuItemsBottomUp(parents);
    }

}
