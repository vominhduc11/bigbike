package com.bigbike.bigbike_backend.domain.catalog;

/**
 * Where a product is pinned on the storefront homepage.
 *
 * Each product is in exactly one slot. Within a slot, products are ordered by
 * `homepageOrder` ascending (null last). Slot capacity is enforced by the admin
 * UI, not by this enum.
 *
 * RECOMMENDED_CAROUSEL was removed in V149 (2026-05-26): the web storefront
 * never rendered that block, so the value was invisible to customers and
 * confusing for admins.
 */
public enum HomepageBlock {
    /** Not on the homepage. */
    NONE,
    /** "Sản phẩm nổi bật" — grid on the homepage (admin-managed, max 12). */
    FEATURED_GRID
}
