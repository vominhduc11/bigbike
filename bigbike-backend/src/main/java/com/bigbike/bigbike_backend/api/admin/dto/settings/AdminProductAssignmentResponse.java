package com.bigbike.bigbike_backend.api.admin.dto.settings;

import java.util.List;

/**
 * Editable "Phân công" (team-assignment) guide shown on both the product and content/article
 * create/edit screens (same data, same endpoint). Backed by {@code product_assign_title} +
 * {@code product_assign_roles} (JSON array, 1-6 entries, V318). Read via
 * {@code GET /api/v1/admin/product-assignment} (gated {@code products.read}); written only by
 * SUPER_ADMIN through the {@code superAdminOnly} settings keys.
 */
public record AdminProductAssignmentResponse(
        String title,
        List<RoleAssignmentDto> roles
) {
    public record RoleAssignmentDto(String id, String name, String items) {}
}
