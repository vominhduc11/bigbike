package com.bigbike.bigbike_backend.domain.catalog;

/**
 * Where a product is pinned on the storefront homepage.
 *
 * Each product is in exactly one of these slots — replaces the prior pair of
 * mutually-overlapping booleans (`isFeatured` + `showOnHomepage`) that admins
 * could toggle independently, even though the web frontend deduped them so
 * the second flag was silently ineffective when the first was set.
 *
 * Within a slot, products are ordered by `homepageOrder` ascending (null last).
 * Slot capacity is enforced by the web frontend, not by this enum.
 */
public enum HomepageBlock {
    /** Not on the homepage. */
    NONE,
    /** "Sản phẩm nổi bật" — grid of 3 products. */
    FEATURED_GRID,
    /** "Gợi ý dành cho bạn" — carousel of 10 products. */
    RECOMMENDED_CAROUSEL
}
