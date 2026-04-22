package com.bigbike.bigbike_backend.migration.wordpress.mapper;

import com.bigbike.bigbike_backend.migration.wordpress.model.WpPost;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpPostMeta;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

@Component
public class WordPressCouponMapper {

    public record MappedCoupon(
            long sourceId,
            String code,
            String description,
            String discountType,    // FIXED or PERCENT
            BigDecimal amount,
            BigDecimal minimumAmount,
            BigDecimal maximumAmount,
            Integer usageLimit,
            int usageCount,
            Instant expiresAt,
            String status,
            List<String> warnings
    ) {}

    public MappedCoupon map(WpPost post, List<WpPostMeta> metas) {
        List<String> warnings = new ArrayList<>();
        Map<String, String> metaMap = metas.stream()
                .filter(m -> m.postId() == post.id())
                .filter(m -> m.metaKey() != null).collect(Collectors.toMap(WpPostMeta::metaKey, m -> m.metaValue() != null ? m.metaValue() : "", (a, b) -> a));

        String code = post.postTitle().trim().toUpperCase();
        String discountType = mapDiscountType(metaMap.get("discount_type"), warnings);
        BigDecimal amount = parseBigDecimal(metaMap.get("coupon_amount"), "coupon_amount", warnings);
        BigDecimal minAmount = parseBigDecimal(metaMap.get("minimum_amount"), "minimum_amount", warnings);
        BigDecimal maxAmount = parseBigDecimal(metaMap.get("maximum_amount"), "maximum_amount", warnings);
        Integer usageLimit = parseInt(metaMap.get("usage_limit"), warnings);
        int usageCount = parseInt2(metaMap.get("usage_count"), 0, warnings);
        Instant expiresAt = parseExpiry(metaMap.get("date_expires"), warnings);

        String status = "trash".equals(post.postStatus()) ? "ARCHIVED" : "ACTIVE";

        return new MappedCoupon(
                post.id(), code, post.postExcerpt(), discountType,
                amount, minAmount, maxAmount, usageLimit, usageCount,
                expiresAt, status, warnings
        );
    }

    private String mapDiscountType(String type, List<String> warnings) {
        if (type == null) { warnings.add("Missing discount_type"); return "FIXED"; }
        return switch (type) {
            case "percent", "percent_product" -> "PERCENT";
            case "fixed_cart", "fixed_product" -> "FIXED";
            default -> { warnings.add("Unknown discount_type: " + type); yield "FIXED"; }
        };
    }

    private BigDecimal parseBigDecimal(String v, String field, List<String> w) {
        if (v == null || v.isBlank()) return null;
        try { return new BigDecimal(v.trim()); }
        catch (NumberFormatException e) { w.add("Cannot parse " + field + ": " + v); return null; }
    }

    private Integer parseInt(String v, List<String> w) {
        if (v == null || v.isBlank()) return null;
        try { return Integer.parseInt(v.trim()); }
        catch (NumberFormatException e) { w.add("Cannot parse usage_limit: " + v); return null; }
    }

    private int parseInt2(String v, int def, List<String> w) {
        if (v == null || v.isBlank()) return def;
        try { return Integer.parseInt(v.trim()); }
        catch (NumberFormatException e) { w.add("Cannot parse usage_count: " + v); return def; }
    }

    private Instant parseExpiry(String v, List<String> w) {
        if (v == null || v.isBlank() || "0".equals(v)) return null;
        try { return Instant.ofEpochSecond(Long.parseLong(v.trim())); }
        catch (NumberFormatException e) { w.add("Cannot parse date_expires: " + v); return null; }
    }
}
