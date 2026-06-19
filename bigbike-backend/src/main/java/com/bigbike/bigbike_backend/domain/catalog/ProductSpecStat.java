package com.bigbike.bigbike_backend.domain.catalog;

/**
 * A single "Specs Dashboard" stat box rendered right under the buy area on the PDP
 * (V235) — a big {@code value} over a {@code label}. Per-product selling-point figure,
 * NOT a technical specification.
 *
 * <p>{@code value}/{@code label} carry the resolved content for the requested locale.
 * The {@code *En} fields carry the raw English values and are populated only on admin
 * reads; they are {@code null} on public reads.
 */
public record ProductSpecStat(
        String value,
        String label,
        String valueEn,
        String labelEn
) {
}
