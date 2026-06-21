package com.bigbike.bigbike_backend.service.pos;

import com.bigbike.bigbike_backend.api.error.ConflictException;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantEntity;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.UUID;

/**
 * Pure stateless POS helpers extracted verbatim from {@link PosOrderService}.
 * No Spring lifecycle, no instance state — only argument-in / value-out logic
 * (price/cost resolution, audit JSON escaping, payment-method validation, UUID
 * parsing). Imported via {@code import static ...PosOrderSupport.*} so call sites
 * in the service stay unchanged.
 */
final class PosOrderSupport {

    private PosOrderSupport() {}

    static BigDecimal resolvePrice(ProductEntity p, ProductVariantEntity v) {
        if (v != null && v.getSalePrice() != null) return v.getSalePrice().setScale(2, RoundingMode.HALF_UP);
        if (v != null && v.getRetailPrice() != null) return v.getRetailPrice().setScale(2, RoundingMode.HALF_UP);
        if (p.getSalePrice() != null) return p.getSalePrice().setScale(2, RoundingMode.HALF_UP);
        return p.getRetailPrice().setScale(2, RoundingMode.HALF_UP);
    }

    // Cost resolution mirrors price: variant cost first, then product cost. NULL = unknown.
    static BigDecimal resolveCost(ProductEntity p, ProductVariantEntity v) {
        if (v != null && v.getCostPrice() != null) return v.getCostPrice().setScale(2, RoundingMode.HALF_UP);
        return p.getCostPrice() != null ? p.getCostPrice().setScale(2, RoundingMode.HALF_UP) : null;
    }

    // Escape free-text (customerName) before embedding in the hand-built audit JSON,
    // so a name containing quotes/backslashes/control chars can't break after_data.
    static String jsonEscape(String s) {
        if (s == null) return "";
        StringBuilder sb = new StringBuilder(s.length());
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"' -> sb.append("\\\"");
                case '\\' -> sb.append("\\\\");
                case '\n' -> sb.append("\\n");
                case '\r' -> sb.append("\\r");
                case '\t' -> sb.append("\\t");
                default -> {
                    if (c < 0x20) sb.append(String.format("\\u%04x", (int) c));
                    else sb.append(c);
                }
            }
        }
        return sb.toString();
    }

    static void validatePaymentMethod(String method) {
        if (!"CASH".equals(method) && !"CARD_TERMINAL".equals(method) && !"CREDIT".equals(method)) {
            throw new ConflictException("POS payment method must be CASH, CARD_TERMINAL, or CREDIT.");
        }
    }

    static UUID tryParseUUID(String s) {
        try { return UUID.fromString(s); } catch (Exception e) { return null; }
    }
}
