package com.bigbike.bigbike_backend.domain.catalog;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;
import java.util.Objects;

public record Brand(
        String id,
        String slug,
        String name,
        String description,
        ImageAsset logo,
        ImageAsset bannerImage,
        SeoMeta seo,
        boolean isVisible,
        boolean showOnHomepage,
        /** Raw English content — non-null only on admin detail reads (V137). */
        BrandTranslations translations,
        Instant createdAt,
        Instant updatedAt,
        /** Admin-only quality diagnostics; null on public reads. */
        @JsonInclude(JsonInclude.Include.NON_NULL)
        BrandLogoQuality logoQuality
) {

    /** Backward-compatible constructor for read-only fixtures and cached projections. */
    public Brand(
            String id,
            String slug,
            String name,
            String description,
            ImageAsset logo,
            ImageAsset bannerImage,
            SeoMeta seo,
            boolean isVisible,
            boolean showOnHomepage,
            BrandTranslations translations,
            Instant createdAt,
            Instant updatedAt
    ) {
        this(id, slug, name, description, logo, bannerImage, seo,
                isVisible, showOnHomepage, translations, createdAt, updatedAt, null);
    }

    public Brand withLogoQuality(BrandLogoQuality quality) {
        return new Brand(id, slug, name, description, logo, bannerImage,
                seo, isVisible, showOnHomepage, translations, createdAt, updatedAt,
                Objects.requireNonNull(quality));
    }
}

