package com.bigbike.bigbike_backend.service.catalog;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

/** Shared literal replacement for configured visual-color labels. */
final class CatalogVisualLabelLocalizer {

    record Replacement(String sourceLabel, String labelEn) {
    }

    private CatalogVisualLabelLocalizer() {
    }

    static String localizeFacetLabels(String value, CatalogVisualFacetCatalog visual) {
        return replace(value, facetReplacements(visual));
    }

    static String localizeAccessibilityLabel(
            String value,
            CatalogVisualFacetCatalog visual,
            Collection<Replacement> displayTerms
    ) {
        List<Replacement> replacements = new ArrayList<>();
        if (displayTerms != null) replacements.addAll(displayTerms);
        replacements.addAll(facetReplacements(visual));
        return replace(value, replacements);
    }

    private static List<Replacement> facetReplacements(CatalogVisualFacetCatalog visual) {
        if (visual == null) return List.of();
        return Stream.concat(visual.colors().stream(), visual.finishes().stream())
                .filter(definition -> hasText(definition.labelVi()) && hasText(definition.labelEn()))
                .map(definition -> new Replacement(definition.labelVi(), definition.labelEn()))
                .toList();
    }

    private static String replace(String value, Collection<Replacement> replacements) {
        if (value == null || replacements == null || replacements.isEmpty()) return value;
        String result = value;
        List<Replacement> ordered = replacements.stream()
                .filter(replacement -> hasText(replacement.sourceLabel()) && hasText(replacement.labelEn()))
                .sorted(Comparator.comparingInt((Replacement replacement) -> replacement.sourceLabel().length())
                        .reversed())
                .toList();
        for (Replacement replacement : ordered) {
            result = result.replaceAll(
                    "(?iu)(?<![\\p{L}\\p{N}])" + Pattern.quote(replacement.sourceLabel())
                            + "(?![\\p{L}\\p{N}])",
                    Matcher.quoteReplacement(replacement.labelEn()));
        }
        return result;
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
