package com.bigbike.bigbike_backend.service.catalog;

import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.BadSqlGrammarException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Localizes only the invisible English label of a storefront color chip.
 *
 * <p>The supplemental terms live outside the facet/alias vocabulary so this
 * display concern cannot change public filtering.
 */
@Service
@RequiredArgsConstructor
public class CatalogColorAccessibilityLabelService {

    private final CatalogVisualFacetCatalogService visualFacetCatalogService;
    private final JdbcTemplate jdbcTemplate;

    @Transactional(readOnly = true)
    public String localize(String value, String locale) {
        if (value == null || !"en".equalsIgnoreCase(locale)) return null;
        return CatalogVisualLabelLocalizer.localizeAccessibilityLabel(
                value, visualFacetCatalogService.activeCatalog(), displayTerms());
    }

    private List<CatalogVisualLabelLocalizer.Replacement> displayTerms() {
        try {
            return jdbcTemplate.query("""
                    SELECT source_label, label_en
                    FROM catalog_visual_display_terms
                    WHERE active = TRUE
                    """, (rs, rowNum) -> new CatalogVisualLabelLocalizer.Replacement(
                    rs.getString("source_label"), rs.getString("label_en")));
        } catch (BadSqlGrammarException ignored) {
            // Focused tests without Flyway deliberately have no configuration tables.
            return List.of();
        }
    }
}
