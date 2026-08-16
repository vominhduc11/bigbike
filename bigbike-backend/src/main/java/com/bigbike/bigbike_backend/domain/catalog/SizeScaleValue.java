package com.bigbike.bigbike_backend.domain.catalog;

/** One canonical value in a configured size scale. */
public record SizeScaleValue(
        String key,
        String label,
        String labelEn,
        String subgroupKey,
        String subgroupLabel,
        String subgroupLabelEn,
        int sortOrder,
        boolean active
) {
    public String localizedLabel(String locale) {
        return "en".equalsIgnoreCase(locale) && labelEn != null && !labelEn.isBlank()
                ? labelEn : label;
    }

    public String localizedSubgroupLabel(String locale) {
        if (subgroupLabel == null || subgroupLabel.isBlank()) return null;
        return "en".equalsIgnoreCase(locale) && subgroupLabelEn != null && !subgroupLabelEn.isBlank()
                ? subgroupLabelEn : subgroupLabel;
    }
}
