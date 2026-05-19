package com.bigbike.bigbike_backend.domain.catalog;

/**
 * A single product specification row.
 *
 * <p>{@code name}/{@code value}/{@code group} carry the resolved content for the
 * requested locale (Vietnamese, or English-with-fallback). The {@code *En} fields
 * carry the raw English values and are populated only on admin reads (so the
 * editor can show both languages); they are {@code null} on public reads.
 */
public record ProductSpecification(
        String name,
        String value,
        String group,
        String nameEn,
        String valueEn,
        String groupEn
) {
}
