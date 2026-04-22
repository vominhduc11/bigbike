package com.bigbike.bigbike_backend.migration.wordpress.mapper;

import com.bigbike.bigbike_backend.migration.wordpress.model.WpTerm;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpTermTaxonomy;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Component;

/**
 * Maps WordPress product_cat taxonomy entries to MappedCategory records.
 */
@Component
public class WordPressCategoryMapper {

    public record MappedCategory(
            long sourceId,
            long termTaxonomyId,
            String slug,
            String name,
            String description,
            Long parentTermId,
            long count,
            String expectedUrl,
            List<String> warnings
    ) {}

    public MappedCategory map(WpTerm term, WpTermTaxonomy taxonomy) {
        List<String> warnings = new ArrayList<>();

        if (term.slug() == null || term.slug().isBlank()) {
            warnings.add("Empty slug for category term_id=" + term.termId());
        }
        if (term.name() == null || term.name().isBlank()) {
            warnings.add("Empty name for category term_id=" + term.termId());
        }

        Long parentTermId = taxonomy.parent() > 0 ? taxonomy.parent() : null;
        String expectedUrl = buildCategoryUrl(term.slug());

        return new MappedCategory(
                term.termId(),
                taxonomy.termTaxonomyId(),
                term.slug(),
                term.name(),
                taxonomy.description(),
                parentTermId,
                taxonomy.count(),
                expectedUrl,
                warnings
        );
    }

    private String buildCategoryUrl(String slug) {
        if (slug == null || slug.isBlank()) return null;
        // WP product category URL: /{slug}.html  (BigBike URL pattern)
        return "/" + slug + ".html";
    }
}
