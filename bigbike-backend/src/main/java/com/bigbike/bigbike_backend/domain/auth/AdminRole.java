package com.bigbike.bigbike_backend.domain.auth;

/**
 * Legacy WordPress role tokens accepted by the import mapping. This enum is not
 * the list of default system roles; runtime role governance is DB-driven through
 * {@code admin_roles.is_system}, where only {@code SUPER_ADMIN} and {@code ADMIN}
 * are protected system roles. Mapping rules from WordPress wp_capabilities are
 * documented in docs/PERMISSION_MATRIX.md — this enum is the target of that
 * mapping (see {@code CapabilityMapper}).
 */
public enum AdminRole {
    SUPER_ADMIN,
    ADMIN,
    EDITOR,
    SHOP_MANAGER,
    AUTHOR,
    CONTRIBUTOR,
    SEO_EDITOR
}
