package com.bigbike.bigbike_backend.api.public_.dto;

import java.util.List;

/**
 * The public guide landing page ({@code GET /api/v1/guide-page}) as served to the storefront. Hero
 * title and each card's title/description are already resolved to the requested language; only
 * enabled cards are returned. The web builds the grid, the sidebar and the
 * {@code pathSegment → pageSlug} map from {@link #entries()}, then fetches each detail body via the
 * CMS pages endpoint.
 *
 * @param heroTitle    hero title resolved to lang (VI fallback)
 * @param heroImageUrl hero banner image URL
 * @param entries      enabled guide cards, ordered
 */
public record PublicGuidePageResponse(
        String heroTitle,
        String heroImageUrl,
        List<Entry> entries
) {
    /** One enabled guide card; title/description already resolved to lang. */
    public record Entry(
            String pathSegment,
            String pageSlug,
            String icon,
            String title,
            String description,
            int sortOrder
    ) {}
}
