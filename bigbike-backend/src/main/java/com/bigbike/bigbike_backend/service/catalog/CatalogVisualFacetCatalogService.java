package com.bigbike.bigbike_backend.service.catalog;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.BadSqlGrammarException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Loads the active visual-facet vocabulary from configuration tables. */
@Service
@RequiredArgsConstructor
class CatalogVisualFacetCatalogService {

    private final JdbcTemplate jdbcTemplate;

    private record Row(
            String type,
            String key,
            String labelVi,
            String labelEn,
            String swatch,
            int sortOrder,
            String alias
    ) {
    }

    private record Builder(
            String type,
            String key,
            String labelVi,
            String labelEn,
            String swatch,
            int sortOrder,
            LinkedHashSet<String> aliases
    ) {
    }

    @Transactional(readOnly = true)
    CatalogVisualFacetCatalog activeCatalog() {
        List<Row> rows;
        try {
            rows = jdbcTemplate.query("""
                SELECT f.facet_type, f.facet_key, f.label_vi, f.label_en, f.swatch,
                       f.sort_order, m.alias_key
                FROM catalog_visual_facets f
                LEFT JOIN catalog_visual_alias_mappings m
                  ON m.facet_type = f.facet_type AND m.facet_key = f.facet_key
                WHERE f.active = TRUE
                ORDER BY f.facet_type, f.sort_order, f.facet_key, m.alias_key
                """, (rs, rowNum) -> new Row(
                rs.getString("facet_type"),
                rs.getString("facet_key"),
                rs.getString("label_vi"),
                rs.getString("label_en"),
                rs.getString("swatch"),
                    rs.getInt("sort_order"),
                    rs.getString("alias_key")));
        } catch (BadSqlGrammarException ignored) {
            // Unit-test profiles intentionally disable Flyway. With no configuration
            // tables there must be no default/ghost color choices.
            return CatalogVisualFacetCatalog.empty();
        }

        Map<String, Builder> builders = new LinkedHashMap<>();
        for (Row row : rows) {
            String compoundKey = row.type() + ":" + row.key();
            Builder builder = builders.computeIfAbsent(compoundKey, ignored -> new Builder(
                    row.type(), row.key(), row.labelVi(), row.labelEn(), row.swatch(),
                    row.sortOrder(), new LinkedHashSet<>()));
            if (row.alias() != null && !row.alias().isBlank()) builder.aliases().add(row.alias());
        }
        List<CatalogVisualFacetCatalog.Definition> definitions = new ArrayList<>();
        for (Builder builder : builders.values()) {
            definitions.add(new CatalogVisualFacetCatalog.Definition(
                    builder.type(), builder.key(), builder.labelVi(), builder.labelEn(),
                    builder.swatch(), builder.sortOrder(), Set.copyOf(builder.aliases())));
        }
        return new CatalogVisualFacetCatalog(definitions);
    }
}
