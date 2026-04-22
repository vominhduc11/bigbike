package com.bigbike.bigbike_backend.domain.auth;

/**
 * Canonical admin roles. Mapping rules from WordPress wp_capabilities are
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
