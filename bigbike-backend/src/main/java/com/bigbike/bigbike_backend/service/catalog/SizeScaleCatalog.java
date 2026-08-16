package com.bigbike.bigbike_backend.service.catalog;

import com.bigbike.bigbike_backend.domain.catalog.Product;
import com.bigbike.bigbike_backend.domain.catalog.ProductVariant;
import com.bigbike.bigbike_backend.domain.catalog.ProductVariantOption;
import com.bigbike.bigbike_backend.domain.catalog.SizeScale;
import com.bigbike.bigbike_backend.domain.catalog.SizeScaleValue;
import java.text.Normalizer;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/** Pure lookup/matching operations over the configured size catalog. */
public final class SizeScaleCatalog {

    private final Map<String, SizeScale> scalesById;
    private final Map<String, Map<String, SizeScaleValue>> valuesByScaleId;

    public SizeScaleCatalog(List<SizeScale> scales) {
        Map<String, SizeScale> byId = new LinkedHashMap<>();
        Map<String, Map<String, SizeScaleValue>> values = new LinkedHashMap<>();
        for (SizeScale scale : scales == null ? List.<SizeScale>of() : scales) {
            if (scale == null || scale.id() == null) continue;
            byId.put(scale.id(), scale);
            Map<String, SizeScaleValue> byKey = new LinkedHashMap<>();
            for (SizeScaleValue value : scale.values() == null ? List.<SizeScaleValue>of() : scale.values()) {
                if (value != null && value.active()) {
                    byKey.put(normalizeValue(value.key()), value);
                }
            }
            values.put(scale.id(), byKey);
        }
        this.scalesById = Collections.unmodifiableMap(byId);
        this.valuesByScaleId = Collections.unmodifiableMap(values);
    }

    public List<SizeScale> scales() {
        return List.copyOf(scalesById.values());
    }

    public Optional<SizeScale> scale(String id) {
        return Optional.ofNullable(scalesById.get(id));
    }

    public boolean hasValue(String scaleId, String rawValue) {
        if (scaleId == null || rawValue == null) return false;
        return valuesByScaleId.getOrDefault(scaleId, Map.of()).containsKey(normalizeValue(rawValue));
    }

    public List<ResolvedSize> resolve(Product product) {
        if (product == null || product.variants() == null) return List.of();
        String scaleId = product.sizeScaleId();
        SizeScale scale = scaleId == null ? null : scalesById.get(scaleId);
        Map<String, SizeScaleValue> values = scale == null
                ? Map.of()
                : valuesByScaleId.getOrDefault(scale.id(), Map.of());
        Map<String, ResolvedSize> unique = new LinkedHashMap<>();
        for (ProductVariant variant : product.variants()) {
            if (variant == null || variant.options() == null) continue;
            for (ProductVariantOption option : variant.options()) {
                if (!isSizeOption(option)) continue;
                String normalized = normalizeValue(option.value());
                SizeScaleValue value = values.get(normalized);
                if (scale != null && value != null) {
                    String token = buildFilterToken(scale, value);
                    unique.putIfAbsent(token, new ResolvedSize(scale, value, token));
                } else if (scale == null && scaleId == null && !normalized.isBlank()) {
                    // Source-compatible fallback for fixtures and pre-migration rows that have no
                    // scale id yet. A missing/inactive configured scale must not silently become
                    // an unnamespaced public bucket.
                    unique.putIfAbsent(normalized, new ResolvedSize(null,
                            new SizeScaleValue(normalized, normalized, normalized, null, null, null, 0, true),
                            normalized));
                }
            }
        }
        return List.copyOf(unique.values());
    }

    public boolean matches(Product product, List<String> rawFilters) {
        List<String> filters = rawFilters == null ? List.of() : rawFilters.stream()
                .map(SizeScaleCatalog::normalizeFilterToken)
                .filter(value -> !value.isBlank())
                .distinct()
                .toList();
        if (filters.isEmpty()) return true;
        return resolve(product).stream().anyMatch(size -> filters.stream().anyMatch(filter -> matchesFilter(size, filter)));
    }

    public String filterToken(SizeScale scale, SizeScaleValue value) {
        return buildFilterToken(scale, value);
    }

    private static boolean matchesFilter(ResolvedSize size, String filter) {
        if (size == null || size.value() == null) return false;
        String normalizedValue = normalizeValue(filterValue(filter));
        if (!normalizedValue.equals(normalizeValue(size.value().key()))) return false;
        String namespace = filterNamespace(filter);
        return namespace == null || (size.scale() != null
                && namespace.equalsIgnoreCase(size.scale().filterNamespace()));
    }

    private static String buildFilterToken(SizeScale scale, SizeScaleValue value) {
        if (scale == null || value == null) return "";
        return normalizeNamespace(scale.filterNamespace()) + ":" + normalizeValue(value.key());
    }

    public static String normalizeFilterToken(String raw) {
        if (raw == null) return "";
        String trimmed = raw.trim();
        int colon = trimmed.indexOf(':');
        if (colon <= 0) return normalizeValue(trimmed);
        String namespace = normalizeNamespace(trimmed.substring(0, colon));
        String value = normalizeValue(trimmed.substring(colon + 1));
        return namespace.isBlank() || value.isBlank() ? "" : namespace + ":" + value;
    }

    public static String normalizeValue(String raw) {
        if (raw == null) return "";
        String normalized = Normalizer.normalize(raw.trim(), Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .replaceAll("\\s+", "")
                .toUpperCase(Locale.ROOT);
        if ("2XL".equals(normalized)) return "XXL";
        if ("XXXL".equals(normalized)) return "3XL";
        return normalized;
    }

    public static boolean isSizeOption(ProductVariantOption option) {
        if (option == null) return false;
        return isSizeOptionName(option.name());
    }

    public static boolean isSizeOptionName(String raw) {
        if (raw == null) return false;
        String normalized = Normalizer.normalize(raw.trim(), Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .replaceAll("[\\s_-]+", "")
                .toLowerCase(Locale.ROOT);
        return Set.of("size", "kichco", "kichthuoc").contains(normalized);
    }

    private static String filterNamespace(String token) {
        int colon = token.indexOf(':');
        return colon <= 0 ? null : normalizeNamespace(token.substring(0, colon));
    }

    private static String filterValue(String token) {
        int colon = token.indexOf(':');
        return colon <= 0 ? token : token.substring(colon + 1);
    }

    private static String normalizeNamespace(String raw) {
        return raw == null ? "" : raw.trim().toLowerCase(Locale.ROOT).replaceAll("\\s+", "-");
    }

    public record ResolvedSize(SizeScale scale, SizeScaleValue value, String token) {
        public String groupKey() {
            return scale == null || scale.group() == null ? null : scale.group().key();
        }

        public String subgroupKey() {
            return value == null ? null : value.subgroupKey();
        }
    }
}
