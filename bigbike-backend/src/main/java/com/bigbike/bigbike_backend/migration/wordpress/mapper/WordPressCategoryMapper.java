package com.bigbike.bigbike_backend.migration.wordpress.mapper;

import com.bigbike.bigbike_backend.migration.wordpress.model.WpTerm;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpTermMeta;
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
            Boolean showOnHomepage,
            Integer sortOrder,
            String expectedUrl,
            List<String> warnings
    ) {}

    public MappedCategory map(WpTerm term, WpTermTaxonomy taxonomy) {
        return map(term, taxonomy, List.of());
    }

    public MappedCategory map(WpTerm term, WpTermTaxonomy taxonomy, List<WpTermMeta> metas) {
        List<String> warnings = new ArrayList<>();

        if (term.slug() == null || term.slug().isBlank()) {
            warnings.add("Empty slug for category term_id=" + term.termId());
        }
        if (term.name() == null || term.name().isBlank()) {
            warnings.add("Empty name for category term_id=" + term.termId());
        }

        Long parentTermId = taxonomy.parent() > 0 ? taxonomy.parent() : null;
        String expectedUrl = buildCategoryUrl(term.slug());
        Boolean showOnHomepage = parseBoolean(readTermMeta(metas, "show_on_homepage"));
        Integer sortOrder = parseInteger(readTermMeta(metas, "ordering"), "ordering", warnings);

        return new MappedCategory(
                term.termId(),
                taxonomy.termTaxonomyId(),
                term.slug(),
                term.name(),
                taxonomy.description(),
                parentTermId,
                taxonomy.count(),
                showOnHomepage,
                sortOrder,
                expectedUrl,
                warnings
        );
    }

    private String buildCategoryUrl(String slug) {
        if (slug == null || slug.isBlank()) return null;
        // WP product category URL: /{slug}.html  (BigBike URL pattern)
        return "/" + slug + ".html";
    }

    private static String readTermMeta(List<WpTermMeta> metas, String key) {
        if (metas == null || key == null) {
            return null;
        }
        for (WpTermMeta meta : metas) {
            if (key.equals(meta.metaKey())) {
                return meta.metaValue();
            }
        }
        return null;
    }

    private static Boolean parseBoolean(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String normalized = value.trim().toLowerCase();
        return normalized.equals("1")
                || normalized.equals("true")
                || normalized.equals("yes")
                || normalized.equals("on");
    }

    private static Integer parseInteger(String value, String field, List<String> warnings) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return Integer.parseInt(value.trim());
        } catch (NumberFormatException e) {
            warnings.add("Cannot parse termmeta " + field + " as int: " + value);
            return null;
        }
    }
}
