package com.bigbike.bigbike_backend.domain.catalog;

import java.util.List;

/** Data-driven product size scale. */
public record SizeScale(
        String id,
        String code,
        String name,
        String nameEn,
        SizeScaleGroup group,
        String filterNamespace,
        int sortOrder,
        boolean active,
        List<SizeScaleValue> values
) {
    public String localizedName(String locale) {
        return "en".equalsIgnoreCase(locale) && nameEn != null && !nameEn.isBlank()
                ? nameEn : name;
    }
}
