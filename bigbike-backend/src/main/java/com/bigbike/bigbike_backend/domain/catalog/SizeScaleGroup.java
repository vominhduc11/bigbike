package com.bigbike.bigbike_backend.domain.catalog;

/** A public display group for one or more configured size scales. */
public record SizeScaleGroup(
        String key,
        String label,
        String labelEn,
        int sortOrder,
        boolean active
) {
    public String localizedLabel(String locale) {
        return "en".equalsIgnoreCase(locale) && labelEn != null && !labelEn.isBlank()
                ? labelEn : label;
    }
}
