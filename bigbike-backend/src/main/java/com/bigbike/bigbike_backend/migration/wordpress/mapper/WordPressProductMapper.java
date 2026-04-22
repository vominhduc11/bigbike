package com.bigbike.bigbike_backend.migration.wordpress.mapper;

import com.bigbike.bigbike_backend.migration.wordpress.model.WpPost;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpPostMeta;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

@Component
public class WordPressProductMapper {

    private static final Set<String> ALLOWED_BACKORDERS = Set.of("no", "notify", "yes");

    public record MappedProduct(
            long sourceId,
            String slug,
            String name,
            String description,
            String sku,
            BigDecimal price,
            BigDecimal regularPrice,
            BigDecimal salePrice,
            Integer stockQuantity,
            String stockStatus,
            Boolean manageStock,
            String backorders,
            BigDecimal weightKg,
            BigDecimal lengthCm,
            BigDecimal widthCm,
            BigDecimal heightCm,
            Boolean forceOutOfStock,
            BigDecimal discountPercentOverride,
            Long thumbnailId,
            List<Long> galleryIds,
            String status,
            String seoTitle,
            String seoDescription,
            List<String> unmappedFields,
            List<String> warnings
    ) {}

    public MappedProduct map(WpPost post, List<WpPostMeta> metas) {
        Map<String, String> metaMap = metas.stream()
                .filter(m -> m.postId() == post.id())
                .filter(m -> m.metaKey() != null)
                .collect(Collectors.toMap(
                        WpPostMeta::metaKey,
                        m -> m.metaValue() != null ? m.metaValue() : "",
                        (a, b) -> a
                ));

        List<String> warnings = new java.util.ArrayList<>();
        List<String> unmapped = new java.util.ArrayList<>();

        String sku = metaMap.get("_sku");
        BigDecimal price = parseBigDecimal(metaMap.get("_price"), "_price", warnings);
        BigDecimal regularPrice = parseBigDecimal(metaMap.get("_regular_price"), "_regular_price", warnings);
        BigDecimal salePrice = parseBigDecimal(metaMap.get("_sale_price"), "_sale_price", warnings);
        Integer stockQty = parseInt(metaMap.get("_stock"), "_stock", warnings);
        String stockStatus = metaMap.getOrDefault("_stock_status", "instock");
        Boolean manageStock = parseYesNo(metaMap.get("_manage_stock"));
        String backorders = normalizeBackorders(metaMap.get("_backorders"), warnings);

        // Physical dimensions — WooCommerce stores in the site's configured unit
        // (typically cm for Vietnamese stores). Stored as-is; unit is implied cm.
        BigDecimal weight = parseBigDecimal(metaMap.get("_weight"), "_weight", warnings);
        BigDecimal length = parseBigDecimal(metaMap.get("_length"), "_length", warnings);
        BigDecimal width  = parseBigDecimal(metaMap.get("_width"),  "_width",  warnings);
        BigDecimal height = parseBigDecimal(metaMap.get("_height"), "_height", warnings);

        // BigBike-specific WooCommerce custom meta.
        Boolean forceOutOfStock = parseYesNo(metaMap.get("_force_out_of_stock"));
        BigDecimal discountPercent = parseBigDecimal(
                firstNonBlank(metaMap.get("_discount_percent_override"), metaMap.get("_wc_discount_percent")),
                "_discount_percent_override", warnings);
        if (discountPercent != null &&
                (discountPercent.compareTo(BigDecimal.ZERO) < 0 ||
                 discountPercent.compareTo(new BigDecimal("100")) > 0)) {
            warnings.add("_discount_percent_override out of range [0,100]: " + discountPercent);
            discountPercent = null;
        }

        Long thumbnailId = parseLong(metaMap.get("_thumbnail_id"), "_thumbnail_id", warnings);
        List<Long> galleryIds = parseGalleryIds(metaMap.get("_product_image_gallery"), warnings);

        // SEO meta: prefer Yoast over RankMath when both are present.
        String seoTitle = firstNonBlank(metaMap.get("_yoast_wpseo_title"), metaMap.get("rank_math_title"));
        String seoDescription = firstNonBlank(metaMap.get("_yoast_wpseo_metadesc"), metaMap.get("rank_math_description"));

        String status = mapPostStatus(post.postStatus());
        if ("UNKNOWN".equals(status)) {
            warnings.add("Unknown post_status: " + post.postStatus());
        }

        if (price == null) {
            warnings.add("Missing _price for product id=" + post.id());
        }

        return new MappedProduct(
                post.id(), post.postName(), post.postTitle(),
                post.postContent(), sku, price, regularPrice, salePrice,
                stockQty, stockStatus, manageStock, backorders,
                weight, length, width, height, forceOutOfStock, discountPercent,
                thumbnailId, galleryIds,
                status, seoTitle, seoDescription, unmapped, warnings
        );
    }

    private String mapPostStatus(String postStatus) {
        return switch (postStatus) {
            case "publish" -> "PUBLISHED";
            case "draft" -> "DRAFT";
            case "trash" -> "TRASH";
            case "pending" -> "PENDING";
            case "private" -> "PRIVATE";
            default -> "UNKNOWN";
        };
    }

    private BigDecimal parseBigDecimal(String value, String field, List<String> warnings) {
        if (value == null || value.isBlank()) return null;
        try {
            return new BigDecimal(value.trim());
        } catch (NumberFormatException e) {
            warnings.add("Cannot parse " + field + " as decimal: " + value);
            return null;
        }
    }

    private Integer parseInt(String value, String field, List<String> warnings) {
        if (value == null || value.isBlank()) return null;
        try {
            return Integer.parseInt(value.trim());
        } catch (NumberFormatException e) {
            warnings.add("Cannot parse " + field + " as int: " + value);
            return null;
        }
    }

    private Long parseLong(String value, String field, List<String> warnings) {
        if (value == null || value.isBlank()) return null;
        try {
            return Long.parseLong(value.trim());
        } catch (NumberFormatException e) {
            warnings.add("Cannot parse " + field + " as long: " + value);
            return null;
        }
    }

    private Boolean parseYesNo(String value) {
        if (value == null || value.isBlank()) return null;
        return "yes".equalsIgnoreCase(value.trim());
    }

    private String normalizeBackorders(String value, List<String> warnings) {
        if (value == null || value.isBlank()) return null;
        String normalized = value.trim().toLowerCase();
        if (!ALLOWED_BACKORDERS.contains(normalized)) {
            warnings.add("Unknown _backorders value: " + value);
            return null;
        }
        return normalized;
    }

    private String firstNonBlank(String a, String b) {
        if (a != null && !a.isBlank()) return a;
        if (b != null && !b.isBlank()) return b;
        return null;
    }

    private List<Long> parseGalleryIds(String value, List<String> warnings) {
        if (value == null || value.isBlank()) return List.of();
        List<Long> ids = new java.util.ArrayList<>();
        for (String part : value.split(",")) {
            String trimmed = part.trim();
            if (trimmed.isBlank()) continue;
            try {
                ids.add(Long.parseLong(trimmed));
            } catch (NumberFormatException e) {
                warnings.add("Cannot parse gallery id: " + trimmed);
            }
        }
        return ids;
    }
}
