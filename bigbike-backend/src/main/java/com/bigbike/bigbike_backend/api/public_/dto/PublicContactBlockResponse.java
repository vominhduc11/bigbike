package com.bigbike.bigbike_backend.api.public_.dto;

/**
 * One enabled contact-page block as served to the storefront ({@code GET /api/v1/contact-page}).
 * Labels and rich-text are already resolved to the requested language; channel values bound to a
 * setting are resolved client-side by the web from the public settings payload it already fetches
 * (via {@link #bindKey()}), while custom channels carry their own {@link #value()}/{@link #href()}.
 */
public record PublicContactBlockResponse(
        String type,
        String column,
        int sortOrder,
        String icon,
        String label,
        String bindKey,
        String value,
        String href,
        String html
) {}
