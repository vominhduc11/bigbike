package com.bigbike.bigbike_backend.migration.wordpress.mapper;

import com.bigbike.bigbike_backend.migration.wordpress.model.WpTerm;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpTermMeta;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpTermTaxonomy;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Component;

/**
 * Maps WordPress pwb-brand taxonomy entries (Perfect WooCommerce Brands) to MappedBrand records.
 */
@Component
public class WordPressBrandMapper {

    public record MappedBrand(
            long sourceId,
            long termTaxonomyId,
            String slug,
            String name,
            String description,
            long count,
            Long thumbnailId,
            String expectedUrl,
            List<String> warnings
    ) {}

    public MappedBrand map(WpTerm term, WpTermTaxonomy taxonomy) {
        return map(term, taxonomy, List.of());
    }

    public MappedBrand map(WpTerm term, WpTermTaxonomy taxonomy, List<WpTermMeta> metas) {
        List<String> warnings = new ArrayList<>();

        if (term.slug() == null || term.slug().isBlank()) {
            warnings.add("Empty slug for brand term_id=" + term.termId());
        }
        if (term.name() == null || term.name().isBlank()) {
            warnings.add("Empty name for brand term_id=" + term.termId());
        }

        Long thumbnailId = parseLong(readTermMeta(metas, "thumbnail_id"), "thumbnail_id", warnings);
        String expectedUrl = buildBrandUrl(term.slug());

        return new MappedBrand(
                term.termId(),
                taxonomy.termTaxonomyId(),
                term.slug(),
                term.name(),
                taxonomy.description(),
                taxonomy.count(),
                thumbnailId,
                expectedUrl,
                warnings
        );
    }

    private static String readTermMeta(List<WpTermMeta> metas, String key) {
        if (metas == null || key == null) return null;
        for (WpTermMeta meta : metas) {
            if (key.equals(meta.metaKey())) return meta.metaValue();
        }
        return null;
    }

    private static Long parseLong(String value, String field, List<String> warnings) {
        if (value == null || value.isBlank()) return null;
        try {
            long parsed = Long.parseLong(value.trim());
            return parsed > 0 ? parsed : null;
        } catch (NumberFormatException e) {
            warnings.add("Cannot parse termmeta " + field + " as long: " + value);
            return null;
        }
    }

    private String buildBrandUrl(String slug) {
        if (slug == null || slug.isBlank()) return null;
        // BigBike brand URL pattern: /thuong-hieu/{slug}.html
        return "/thuong-hieu/" + slug + ".html";
    }
}
