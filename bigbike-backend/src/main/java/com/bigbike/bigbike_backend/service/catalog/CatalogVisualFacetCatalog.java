package com.bigbike.bigbike_backend.service.catalog;

import com.bigbike.bigbike_backend.domain.catalog.Product;
import com.bigbike.bigbike_backend.domain.catalog.ProductVariantOption;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/** Data-backed vocabulary and matcher for storefront base colors and finishes. */
final class CatalogVisualFacetCatalog {

    static final String COLOR = "COLOR";
    static final String FINISH = "FINISH";

    record Definition(
            String type,
            String key,
            String labelVi,
            String labelEn,
            String swatch,
            int sortOrder,
            Set<String> aliases
    ) {
        String label(String locale) {
            return "en".equalsIgnoreCase(locale) && labelEn != null && !labelEn.isBlank()
                    ? labelEn
                    : labelVi;
        }
    }

    record Selection(
            Set<String> colors,
            Set<String> finishes,
            boolean colorRequested,
            boolean finishRequested
    ) {
        static Selection empty() {
            return new Selection(Set.of(), Set.of(), false, false);
        }
    }

    private record OptionFacets(Set<String> colors, Set<String> finishes) {
    }

    private final List<Definition> colors;
    private final List<Definition> finishes;
    private final Map<String, Definition> colorsByKey;
    private final Map<String, Definition> finishesByKey;
    private final Map<String, OptionFacets> facetsByAlias;

    static CatalogVisualFacetCatalog empty() {
        return new CatalogVisualFacetCatalog(List.of());
    }

    CatalogVisualFacetCatalog(Collection<Definition> definitions) {
        List<Definition> ordered = definitions == null
                ? List.of()
                : definitions.stream()
                        .filter(Objects::nonNull)
                        .sorted(Comparator.comparingInt(Definition::sortOrder).thenComparing(Definition::key))
                        .toList();
        this.colors = ordered.stream().filter(item -> COLOR.equals(item.type())).toList();
        this.finishes = ordered.stream().filter(item -> FINISH.equals(item.type())).toList();
        this.colorsByKey = indexByKey(colors);
        this.finishesByKey = indexByKey(finishes);

        Map<String, Set<String>> colorKeysByAlias = new LinkedHashMap<>();
        Map<String, Set<String>> finishKeysByAlias = new LinkedHashMap<>();
        for (Definition definition : ordered) {
            for (String rawAlias : definition.aliases() == null ? Set.<String>of() : definition.aliases()) {
                String alias = CatalogReadSupport.colorBaseSlug(rawAlias);
                if (alias.isBlank()) continue;
                Map<String, Set<String>> target = COLOR.equals(definition.type())
                        ? colorKeysByAlias
                        : finishKeysByAlias;
                target.computeIfAbsent(alias, ignored -> new LinkedHashSet<>()).add(definition.key());
            }
        }
        Set<String> allAliases = new LinkedHashSet<>(colorKeysByAlias.keySet());
        allAliases.addAll(finishKeysByAlias.keySet());
        Map<String, OptionFacets> aliasIndex = new LinkedHashMap<>();
        for (String alias : allAliases) {
            aliasIndex.put(alias, new OptionFacets(
                    Set.copyOf(colorKeysByAlias.getOrDefault(alias, Set.of())),
                    Set.copyOf(finishKeysByAlias.getOrDefault(alias, Set.of()))));
        }
        this.facetsByAlias = Map.copyOf(aliasIndex);
    }

    private static Map<String, Definition> indexByKey(List<Definition> values) {
        Map<String, Definition> result = new LinkedHashMap<>();
        for (Definition value : values) result.put(value.key(), value);
        return Map.copyOf(result);
    }

    List<Definition> colors() {
        return colors;
    }

    List<Definition> finishes() {
        return finishes;
    }

    Selection resolve(List<String> rawColors, List<String> rawFinishes) {
        Set<String> colors = resolveKeys(rawColors, colorsByKey, true);
        Set<String> finishes = resolveKeys(rawFinishes, finishesByKey, false);
        boolean colorRequested = hasValue(rawColors) && !colors.isEmpty();
        boolean finishRequested = hasValue(rawFinishes);
        return new Selection(
                colors,
                finishes,
                colorRequested,
                finishRequested);
    }

    private Set<String> resolveKeys(
            List<String> requested,
            Map<String, Definition> canonical,
            boolean color
    ) {
        if (requested == null) return Set.of();
        Set<String> resolved = new LinkedHashSet<>();
        for (String raw : requested) {
            String key = CatalogReadSupport.colorBaseSlug(raw);
            if (key.isBlank()) continue;
            if (canonical.containsKey(key)) {
                resolved.add(key);
                continue;
            }
            OptionFacets mapped = facetsByAlias.get(key);
            if (mapped != null) resolved.addAll(color ? mapped.colors() : mapped.finishes());
        }
        return Set.copyOf(resolved);
    }

    boolean matches(Product product, Selection selection) {
        if (selection == null || (!selection.colorRequested() && !selection.finishRequested())) return true;
        if (selection.colorRequested() && selection.colors().isEmpty()) return false;
        if (selection.finishRequested() && selection.finishes().isEmpty()) return false;
        for (String alias : visualAliases(product)) {
            OptionFacets facets = facetsByAlias.get(alias);
            if (facets == null) continue;
            boolean colorMatches = !selection.colorRequested()
                    || intersects(facets.colors(), selection.colors());
            boolean finishMatches = !selection.finishRequested()
                    || intersects(facets.finishes(), selection.finishes());
            if (colorMatches && finishMatches) return true;
        }
        return false;
    }

    /** Every spelling the catalogue accepts for a colour, canonical keys included. */
    Set<String> colorVocabulary() {
        Set<String> terms = new LinkedHashSet<>(colorsByKey.keySet());
        facetsByAlias.forEach((alias, facets) -> {
            if (!facets.colors().isEmpty()) terms.add(alias);
        });
        return Set.copyOf(terms);
    }

    Set<String> colorsFor(Product product) {
        return facetKeysFor(product, true);
    }

    Set<String> finishesFor(Product product) {
        return facetKeysFor(product, false);
    }

    private Set<String> facetKeysFor(Product product, boolean color) {
        Set<String> result = new LinkedHashSet<>();
        for (String alias : visualAliases(product)) {
            OptionFacets mapped = facetsByAlias.get(alias);
            if (mapped != null) result.addAll(color ? mapped.colors() : mapped.finishes());
        }
        return Set.copyOf(result);
    }

    Set<String> unmappedAliases(Product product) {
        Set<String> result = new LinkedHashSet<>();
        for (String alias : visualAliases(product)) {
            if (!facetsByAlias.containsKey(alias)) result.add(alias);
        }
        return Set.copyOf(result);
    }

    private static List<String> visualAliases(Product product) {
        if (product == null || product.variants() == null) return List.of();
        List<String> aliases = new ArrayList<>();
        product.variants().stream()
                .filter(Objects::nonNull)
                .filter(variant -> variant.options() != null)
                .flatMap(variant -> variant.options().stream())
                .filter(Objects::nonNull)
                .filter(option -> CatalogReadSupport.isColorOption(option.name()))
                .map(ProductVariantOption::value)
                .map(CatalogReadSupport::colorBaseSlug)
                .filter(value -> !value.isBlank())
                .forEach(aliases::add);
        return aliases;
    }

    private static boolean intersects(Set<String> left, Set<String> right) {
        return left.stream().anyMatch(right::contains);
    }

    private static boolean hasValue(List<String> values) {
        return values != null && values.stream().anyMatch(value -> value != null && !value.isBlank());
    }
}
