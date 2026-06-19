package com.bigbike.bigbike_backend.domain.catalog;

/**
 * A single product commitment row rendered under the buy buttons on the PDP
 * (delivery / exchange / warranty …). Per-product (V232).
 *
 * <p>{@code title}/{@code subtitle} carry the resolved content for the requested
 * locale. The {@code *En} fields carry the raw English values and are populated
 * only on admin reads; they are {@code null} on public reads. {@code icon} is a
 * key from the fixed web icon set.
 */
public record ProductCommitment(
        String icon,
        String title,
        String subtitle,
        String titleEn,
        String subtitleEn
) {
}
