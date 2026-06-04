package com.bigbike.bigbike_backend.api.admin.dto.settings;

/**
 * Editable "Phân công" (team-assignment) guide text shown on the product create/edit screen.
 * Backed by the {@code product_assign_*} site-setting keys. Read via
 * {@code GET /api/v1/admin/product-assignment} (gated {@code products.read}); written only by
 * SUPER_ADMIN through the {@code superAdminOnly} settings keys.
 */
public record AdminProductAssignmentResponse(
        String title,
        String roleContent,
        String itemsContent,
        String roleSeo,
        String itemsSeo,
        String roleManager,
        String itemsManager
) {}
