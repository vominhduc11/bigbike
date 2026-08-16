package com.bigbike.bigbike_backend.domain.catalog;

import java.util.Collection;
import java.util.List;

/** Canonical product-gender normalization shared by persistence, API and filters. */
public final class ProductGenderSupport {

    public static final String MALE = "Nam";
    public static final String FEMALE = "Nữ";

    private ProductGenderSupport() {
    }

    public static List<String> fromFlags(boolean male, boolean female) {
        if (male && female) return List.of(MALE, FEMALE);
        if (male) return List.of(MALE);
        if (female) return List.of(FEMALE);
        return List.of();
    }

    /**
     * Normalizes the canonical array and rejects blank, unknown or duplicate values.
     * The returned order is always Nam, Nữ regardless of input order.
     */
    public static List<String> normalize(Collection<String> values) {
        boolean male = false;
        boolean female = false;
        if (values != null) {
            for (String raw : values) {
                if (raw == null || raw.isBlank()) {
                    throw new IllegalArgumentException("Gender values must be Nam or Nữ.");
                }
                String value = raw.trim();
                if (MALE.equalsIgnoreCase(value)) {
                    if (male) throw new IllegalArgumentException("Gender values must be unique.");
                    male = true;
                } else if (FEMALE.equalsIgnoreCase(value)) {
                    if (female) throw new IllegalArgumentException("Gender values must be unique.");
                    female = true;
                } else {
                    throw new IllegalArgumentException("Gender values must be Nam or Nữ.");
                }
            }
        }
        return fromFlags(male, female);
    }

    /** Legacy scalar adapter used only while reading old import/API payloads. */
    public static List<String> fromLegacy(String raw) {
        if (raw == null || raw.isBlank()) return List.of();
        String value = raw.trim();
        if ("Unisex".equalsIgnoreCase(value)) return List.of();
        if (MALE.equalsIgnoreCase(value)) return List.of(MALE);
        if (FEMALE.equalsIgnoreCase(value)) return List.of(FEMALE);
        throw new IllegalArgumentException("Gender must be Nam, Nữ, Unisex, or blank.");
    }

    public static boolean contains(Collection<String> values, String gender) {
        if (values == null || gender == null) return false;
        return values.stream().anyMatch(value -> gender.equalsIgnoreCase(value));
    }

    /** Compatibility parser for old repeated public query parameters: first supported wins. */
    public static List<String> firstSupported(Collection<String> values) {
        if (values == null) return List.of();
        for (String raw : values) {
            if (raw == null || raw.isBlank()) continue;
            String value = raw.trim();
            if (MALE.equalsIgnoreCase(value)) return List.of(MALE);
            if (FEMALE.equalsIgnoreCase(value)) return List.of(FEMALE);
        }
        return List.of();
    }

    public static String toCsv(Collection<String> values) {
        return String.join("|", normalize(values));
    }
}
