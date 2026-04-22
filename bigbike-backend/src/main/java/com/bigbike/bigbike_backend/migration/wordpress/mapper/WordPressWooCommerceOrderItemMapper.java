package com.bigbike.bigbike_backend.migration.wordpress.mapper;

import com.bigbike.bigbike_backend.migration.wordpress.model.WpOrderItem;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpOrderItemMeta;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/**
 * Maps kd_woocommerce_order_items rows (with their kd_woocommerce_order_itemmeta)
 * to typed domain records.
 *
 * Type routing:
 *   line_item → MappedLineItem
 *   shipping   → MappedShippingItem
 *   fee        → MappedFeeItem
 *   coupon     → MappedCouponItem
 *   tax        → deferred (counted, not mapped)
 *   unknown    → skipped with warning
 */
@Component
public class WordPressWooCommerceOrderItemMapper {

    public record MappedLineItem(
            long legacyItemId,
            Long productLegacyId,
            Long variationLegacyId,
            String sku,
            String productName,
            int quantity,
            BigDecimal lineSubtotal,
            BigDecimal lineSubtotalTax,
            BigDecimal lineTotal,
            BigDecimal lineTax,
            List<String> warnings
    ) {}

    public record MappedShippingItem(
            long legacyItemId,
            String methodTitle,
            String methodId,
            BigDecimal cost,
            BigDecimal totalTax,
            List<String> warnings
    ) {}

    public record MappedFeeItem(
            long legacyItemId,
            String name,
            BigDecimal lineTotal,
            BigDecimal lineTax,
            List<String> warnings
    ) {}

    public record MappedCouponItem(
            long legacyItemId,
            String code,
            BigDecimal discountAmount,
            BigDecimal discountAmountTax,
            List<String> warnings
    ) {}

    public MappedLineItem mapLineItem(WpOrderItem item, List<WpOrderItemMeta> metas) {
        List<String> warnings = new ArrayList<>();
        Map<String, String> meta = toMetaMap(metas);

        Long productId = parseLongMeta(meta.get("_product_id"));
        Long variationId = parseLongMeta(meta.get("_variation_id"));
        if (variationId != null && variationId == 0L) variationId = null;

        if (productId == null) {
            warnings.add("Missing _product_id for line_item id=" + item.orderItemId());
        }

        int qty = 1;
        String qtyStr = meta.get("_qty");
        if (qtyStr != null && !qtyStr.isBlank()) {
            try {
                qty = Integer.parseInt(qtyStr.trim());
            } catch (NumberFormatException e) {
                warnings.add("Cannot parse _qty for item id=" + item.orderItemId() + ": " + qtyStr);
            }
        }
        if (qty <= 0) {
            warnings.add("Invalid quantity " + qty + " for line_item id=" + item.orderItemId());
        }

        return new MappedLineItem(
                item.orderItemId(), productId, variationId,
                meta.get("_sku"), item.orderItemName(), qty,
                parseBD(meta.get("_line_subtotal"), "_line_subtotal", warnings),
                parseBD(meta.get("_line_subtotal_tax"), "_line_subtotal_tax", warnings),
                parseBD(meta.get("_line_total"), "_line_total", warnings),
                parseBD(meta.get("_line_tax"), "_line_tax", warnings),
                warnings
        );
    }

    public MappedShippingItem mapShippingItem(WpOrderItem item, List<WpOrderItemMeta> metas) {
        List<String> warnings = new ArrayList<>();
        Map<String, String> meta = toMetaMap(metas);
        return new MappedShippingItem(
                item.orderItemId(),
                item.orderItemName(),
                meta.get("method_id"),
                parseBD(meta.get("cost"), "cost", warnings),
                parseBD(meta.get("total_tax"), "total_tax", warnings),
                warnings
        );
    }

    public MappedFeeItem mapFeeItem(WpOrderItem item, List<WpOrderItemMeta> metas) {
        List<String> warnings = new ArrayList<>();
        Map<String, String> meta = toMetaMap(metas);
        return new MappedFeeItem(
                item.orderItemId(),
                item.orderItemName(),
                parseBD(meta.get("_line_total"), "_line_total", warnings),
                parseBD(meta.get("_line_tax"), "_line_tax", warnings),
                warnings
        );
    }

    public MappedCouponItem mapCouponItem(WpOrderItem item, List<WpOrderItemMeta> metas) {
        List<String> warnings = new ArrayList<>();
        Map<String, String> meta = toMetaMap(metas);
        return new MappedCouponItem(
                item.orderItemId(),
                item.orderItemName(),
                parseBD(meta.get("discount_amount"), "discount_amount", warnings),
                parseBD(meta.get("discount_amount_tax"), "discount_amount_tax", warnings),
                warnings
        );
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private Map<String, String> toMetaMap(List<WpOrderItemMeta> metas) {
        if (metas == null) return Map.of();
        return metas.stream()
                .filter(m -> m.metaKey() != null)
                .collect(Collectors.toMap(
                        WpOrderItemMeta::metaKey,
                        m -> m.metaValue() != null ? m.metaValue() : "",
                        (a, b) -> a
                ));
    }

    private BigDecimal parseBD(String v, String field, List<String> warnings) {
        if (v == null || v.isBlank()) return BigDecimal.ZERO;
        try { return new BigDecimal(v.trim()); }
        catch (NumberFormatException e) {
            warnings.add("Cannot parse " + field + ": " + v);
            return BigDecimal.ZERO;
        }
    }

    private Long parseLongMeta(String v) {
        if (v == null || v.isBlank()) return null;
        try { return Long.parseLong(v.trim()); }
        catch (NumberFormatException e) { return null; }
    }
}
