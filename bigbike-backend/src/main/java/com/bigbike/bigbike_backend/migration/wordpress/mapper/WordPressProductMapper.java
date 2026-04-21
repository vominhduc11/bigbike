package com.bigbike.bigbike_backend.migration.wordpress.mapper;

import com.bigbike.bigbike_backend.migration.wordpress.model.WpPost;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpPostMeta;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

@Component
public class WordPressProductMapper {

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
            Long thumbnailId,
            List<Long> galleryIds,
            String status,
            List<String> unmappedFields,
            List<String> warnings
    ) {}

    public MappedProduct map(WpPost post, List<WpPostMeta> metas) {
        Map<String, String> metaMap = metas.stream()
                .filter(m -> m.postId() == post.id())
                .collect(Collectors.toMap(
                        WpPostMeta::metaKey,
                        WpPostMeta::metaValue,
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
        Long thumbnailId = parseLong(metaMap.get("_thumbnail_id"), "_thumbnail_id", warnings);
        List<Long> galleryIds = parseGalleryIds(metaMap.get("_product_image_gallery"), warnings);

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
                stockQty, stockStatus, thumbnailId, galleryIds,
                status, unmapped, warnings
        );
    }

    private String mapPostStatus(String postStatus) {
        return switch (postStatus) {
            case "publish" -> "ACTIVE";
            case "draft" -> "DRAFT";
            case "trash" -> "ARCHIVED";
            case "pending" -> "DRAFT";
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
