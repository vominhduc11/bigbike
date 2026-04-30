package com.bigbike.bigbike_backend.migration.wordpress.mapper;

import com.bigbike.bigbike_backend.migration.wordpress.model.WpPost;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpPostMeta;
import com.bigbike.bigbike_backend.migration.wordpress.parser.PhpSerializeParser;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/**
 * Maps WordPress product_variation posts to MappedVariation records.
 * Parent product is identified via post_parent.
 *
 * Attributes are stored as postmeta with keys like: attribute_pa_{name} or attribute_{name}.
 */
@Component
public class WordPressVariationMapper {

    public record MappedVariation(
            long sourceId,
            long parentProductId,
            String sku,
            BigDecimal price,
            BigDecimal regularPrice,
            BigDecimal salePrice,
            Integer stockQuantity,
            String stockStatus,
            Map<String, String> attributes,
            String status,
            /**
             * Per-variation gallery attachment IDs sourced from the
             * `rtwpvg_images` postmeta written by the WP plugin
             * "Variation Images Gallery for WooCommerce". Order is preserved
             * as it appears in the serialized PHP array.
             */
            List<Long> galleryAttachmentIds,
            List<String> warnings
    ) {}

    private final PhpSerializeParser phpParser = new PhpSerializeParser();

    public MappedVariation map(WpPost post, List<WpPostMeta> metas) {
        List<String> warnings = new ArrayList<>();

        Map<String, String> meta = metas.stream()
                .filter(m -> m.postId() == post.id())
                .filter(m -> m.metaKey() != null).collect(Collectors.toMap(WpPostMeta::metaKey, m -> m.metaValue() != null ? m.metaValue() : "", (a, b) -> a));

        String sku = meta.get("_sku");
        BigDecimal price = parseBigDecimal(meta.get("_price"), "_price", post.id(), warnings);
        BigDecimal regularPrice = parseBigDecimal(meta.get("_regular_price"), "_regular_price", post.id(), warnings);
        BigDecimal salePrice = parseBigDecimal(meta.get("_sale_price"), "_sale_price", post.id(), warnings);
        Integer stockQty = parseInt(meta.get("_stock"), "_stock", post.id(), warnings);
        String stockStatus = meta.getOrDefault("_stock_status", "instock");

        Map<String, String> attributes = new HashMap<>();
        for (Map.Entry<String, String> entry : meta.entrySet()) {
            String key = entry.getKey();
            if (key.startsWith("attribute_")) {
                String attrName = key.substring("attribute_".length())
                        .replaceFirst("^pa_", "");
                attributes.put(attrName, entry.getValue());
            }
        }

        if (price == null && regularPrice == null) {
            warnings.add("No price for variation id=" + post.id() + " (parent=" + post.postParent() + ")");
        }

        String status = mapStatus(post.postStatus());

        List<Long> galleryAttachmentIds = parseRtwpvgImages(meta.get("rtwpvg_images"), post.id(), warnings);

        return new MappedVariation(
                post.id(),
                post.postParent(),
                sku,
                price,
                regularPrice,
                salePrice,
                stockQty,
                stockStatus,
                attributes,
                status,
                galleryAttachmentIds,
                warnings
        );
    }

    /**
     * Decodes the WP `rtwpvg_images` postmeta — a serialized PHP array of
     * attachment IDs in display order. Example payload:
     *   {@code a:4:{i:0;i:8738;i:1;i:8737;i:2;i:8736;i:3;i:8734;}}
     * Returns the IDs in their original order. Non-integer values are
     * skipped with a warning so a single bad row doesn't drop the gallery.
     */
    @SuppressWarnings("unchecked")
    private List<Long> parseRtwpvgImages(String raw, long sourceId, List<String> warnings) {
        if (raw == null || raw.isBlank()) {
            return List.of();
        }
        PhpSerializeParser.ParseResult parsed = phpParser.parse(raw);
        warnings.addAll(parsed.warnings());
        Object value = parsed.value();
        if (!(value instanceof Map<?, ?> map)) {
            warnings.add("rtwpvg_images is not a PHP array for variation id=" + sourceId);
            return List.of();
        }
        List<Long> ids = new ArrayList<>(map.size());
        for (Object v : ((Map<Object, Object>) map).values()) {
            if (v instanceof Long l) {
                ids.add(l);
            } else if (v instanceof Number n) {
                ids.add(n.longValue());
            } else if (v instanceof String s && !s.isBlank()) {
                try { ids.add(Long.parseLong(s.trim())); }
                catch (NumberFormatException e) {
                    warnings.add("rtwpvg_images contains non-integer entry for variation id=" + sourceId + ": " + s);
                }
            }
        }
        return ids;
    }

    private String mapStatus(String postStatus) {
        return switch (postStatus == null ? "" : postStatus) {
            case "publish" -> "ACTIVE";
            case "private" -> "ACTIVE";
            case "draft"   -> "DRAFT";
            case "trash"   -> "ARCHIVED";
            default        -> "DRAFT";
        };
    }

    private BigDecimal parseBigDecimal(String value, String field, long postId, List<String> warnings) {
        if (value == null || value.isBlank()) return null;
        try { return new BigDecimal(value.trim()); }
        catch (NumberFormatException e) {
            warnings.add("Cannot parse " + field + " for variation id=" + postId + ": " + value);
            return null;
        }
    }

    private Integer parseInt(String value, String field, long postId, List<String> warnings) {
        if (value == null || value.isBlank()) return null;
        try { return Integer.parseInt(value.trim()); }
        catch (NumberFormatException e) {
            warnings.add("Cannot parse " + field + " for variation id=" + postId + ": " + value);
            return null;
        }
    }
}
