package com.bigbike.bigbike_backend.migration.wordpress.mapper;

import com.bigbike.bigbike_backend.migration.wordpress.model.WpTerm;
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
            String expectedUrl,
            List<String> warnings
    ) {}

    public MappedBrand map(WpTerm term, WpTermTaxonomy taxonomy) {
        List<String> warnings = new ArrayList<>();

        if (term.slug() == null || term.slug().isBlank()) {
            warnings.add("Empty slug for brand term_id=" + term.termId());
        }
        if (term.name() == null || term.name().isBlank()) {
            warnings.add("Empty name for brand term_id=" + term.termId());
        }

        String expectedUrl = buildBrandUrl(term.slug());

        return new MappedBrand(
                term.termId(),
                taxonomy.termTaxonomyId(),
                term.slug(),
                term.name(),
                taxonomy.description(),
                taxonomy.count(),
                expectedUrl,
                warnings
        );
    }

    private String buildBrandUrl(String slug) {
        if (slug == null || slug.isBlank()) return null;
        // BigBike brand URL pattern: /thuong-hieu/{slug}.html
        return "/thuong-hieu/" + slug + ".html";
    }
}
