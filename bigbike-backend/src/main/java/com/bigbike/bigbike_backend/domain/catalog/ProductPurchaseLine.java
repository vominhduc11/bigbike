package com.bigbike.bigbike_backend.domain.catalog;

/**
 * A single "Mua tại BigBike.vn" line rendered in the purchase block on the PDP
 * (Bảo hành / Giao hàng / Đổi trả …). Per-product (V249).
 *
 * <p>{@code label}/{@code value} carry the resolved content for the requested
 * locale. The {@code *En} fields carry the raw English values and are populated
 * only on admin reads; they are {@code null} on public reads. {@code icon} is a
 * key from the fixed web icon set.
 */
public record ProductPurchaseLine(
        String icon,
        String label,
        String value,
        String labelEn,
        String valueEn
) {
}
