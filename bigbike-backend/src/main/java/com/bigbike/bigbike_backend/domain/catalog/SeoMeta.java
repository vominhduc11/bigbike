package com.bigbike.bigbike_backend.domain.catalog;

public record SeoMeta(
        String title,
        String description,
        String canonicalUrl,
        ImageAsset ogImage,
        /** Per-entity SEO noindex flag (V222). Only articles populate it; everything else passes false. */
        boolean noIndex
) {
}

