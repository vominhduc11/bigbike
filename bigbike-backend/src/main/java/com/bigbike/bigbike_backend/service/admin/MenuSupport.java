package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.menu.AdminMenuItemResponse;
import com.bigbike.bigbike_backend.api.admin.dto.menu.AdminMenuResponse;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.persistence.entity.audit.AuditLogEntity;
import com.bigbike.bigbike_backend.persistence.entity.menu.MenuEntity;
import com.bigbike.bigbike_backend.persistence.entity.menu.MenuItemEntity;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Pure, stateless helpers for {@link AdminMenuService}: DTO mapping, validation
 * (no repository access), audit-log builders, JSON snapshots, and small string
 * utilities. Holds no Spring beans or instance state — extracted verbatim from
 * the service so call sites stay unchanged via {@code import static}.
 */
final class MenuSupport {

    private MenuSupport() {}

    static boolean isAncestorChainActive(MenuItemEntity item, Map<UUID, MenuItemEntity> activeById) {
        UUID parentId = item.getParentId();
        while (parentId != null) {
            MenuItemEntity parent = activeById.get(parentId);
            if (parent == null) return false;
            parentId = parent.getParentId();
        }
        return true;
    }

    // ── Validation ────────────────────────────────────────────────────────────

    /**
     * Validates that a menu item URL uses only safe schemes.
     * Null/blank is allowed (group/header items with no destination).
     * Allowed: relative paths starting with {@code /}, {@code https://}, {@code http://},
     * {@code mailto:}, {@code tel:}, and in-page anchors starting with {@code #}.
     * Blocked: {@code javascript:}, {@code data:}, {@code vbscript:}, protocol-relative {@code //},
     * and any value containing CRLF characters.
     */
    static void validateMenuItemUrl(String url) {
        if (url == null || url.isBlank()) return;
        // Block CRLF injection
        if (url.contains("\n") || url.contains("\r")) {
            throw ValidationException.fromField("url", "INVALID_MENU_ITEM_URL",
                    "Menu item URL contains invalid characters.");
        }
        String lower = url.trim().toLowerCase(Locale.ROOT);
        // Block dangerous schemes
        if (lower.startsWith("javascript:") || lower.startsWith("data:")
                || lower.startsWith("vbscript:") || lower.startsWith("//")) {
            throw ValidationException.fromField("url", "INVALID_MENU_ITEM_URL",
                    "Menu item URL has an unsafe scheme.");
        }
        // Allow safe schemes and relative paths
        boolean valid = lower.startsWith("/") || lower.startsWith("https://")
                || lower.startsWith("http://") || lower.startsWith("mailto:")
                || lower.startsWith("tel:") || lower.startsWith("#");
        if (!valid) {
            throw ValidationException.fromField("url", "INVALID_MENU_ITEM_URL",
                    "Menu item URL must start with /, https://, http://, mailto:, tel:, or #.");
        }
    }

    static void validateParentBelongsToMenu(List<MenuItemEntity> allItems, UUID parentId, UUID menuId) {
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
    static void validateNoDeepCycle(List<MenuItemEntity> allItems, UUID itemId, UUID parentId) {
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
    static void detectCycleInMap(Map<UUID, UUID> parentMap, UUID startItemId) {
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

    static AdminMenuResponse toMenuResponse(MenuEntity m, List<MenuItemEntity> items) {
        return new AdminMenuResponse(
                m.getId(), m.getLocation(), m.getName(), m.getStatus(),
                m.getCreatedAt(), m.getUpdatedAt(),
                items.stream().map(MenuSupport::toItemResponse).toList()
        );
    }

    static AdminMenuItemResponse toItemResponse(MenuItemEntity i) {
        return new AdminMenuItemResponse(
                i.getId(), i.getMenu().getId(), i.getParentId(),
                i.getLabel(), i.getLabelEn(), i.getUrl(), i.getTargetType(), i.getTargetId(),
                i.getSortOrder(), i.isOpenInNewTab(), i.getCssClass(),
                i.getStatus(), i.getCreatedAt(), i.getUpdatedAt()
        );
    }

    /** EN-with-Vietnamese-fallback per PRODUCT_RULE_002: returns the English value only when present. */
    static String pick(String base, String en, String locale) {
        return "en".equalsIgnoreCase(locale) && en != null && !en.isBlank() ? en : base;
    }

    /** Trim an optional text field; blank/null → null (so a cleared English label stores NULL). */
    static String normalizeOptional(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    // ── Audit helpers ─────────────────────────────────────────────────────────

    static AuditLogEntity buildMenuAudit(UUID adminId, String action, UUID resourceId,
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

    static AuditLogEntity buildItemAudit(UUID adminId, String action, UUID resourceId,
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

    static String menuSnapshot(MenuEntity m) {
        return "{\"location\":\"" + escapeJson(m.getLocation()) +
               "\",\"name\":\"" + escapeJson(m.getName()) +
               "\",\"status\":\"" + m.getStatus() + "\"}";
    }

    static String itemSnapshot(MenuItemEntity i) {
        return "{\"label\":\"" + escapeJson(i.getLabel()) +
               "\",\"sortOrder\":" + i.getSortOrder() +
               ",\"status\":\"" + i.getStatus() + "\"}";
    }

    static boolean matchesQ(String field, String qLower) {
        return field != null && field.toLowerCase(Locale.ROOT).contains(qLower);
    }

    static String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
