package com.bigbike.bigbike_backend.domain.content;

/**
 * Lightweight reference to a catalog product linked to an article, used by the admin content
 * editor to render product chips without fetching full product detail.
 */
public record RelatedProductRef(
        String id,
        String slug,
        String name,
        String imageUrl
) {
}
