package com.bigbike.bigbike_backend.domain.catalog;

/**
 * A single trust badge rendered on the trust row ABOVE the product title on the PDP
 * (e.g. "Chính hãng", "BH 2 năm", "Freeship"). Per-product — admin curates the list
 * per product; an empty list hides the row.
 *
 * <p>{@code content} carries the resolved label for the requested locale. {@code contentEn}
 * carries the raw English value and is populated only on admin reads; it is {@code null}
 * on public reads.
 */
public record TrustBadge(
        String content,
        String contentEn
) {
}
