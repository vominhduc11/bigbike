package com.bigbike.bigbike_backend.api.admin.dto;

import java.util.List;

/**
 * Records currently missing English content in a field that is now required
 * (TRANSLATION_RULE_002) after the removal of Gemini auto-translation (V312). Helps admin
 * proactively find and fix old records before they get blocked from saving.
 */
public record MissingRequiredEnglishResponse(
        List<Item> products,
        List<Item> categories,
        List<Item> brands,
        List<Item> articles,
        List<String> settingKeys
) {
    /** {@code name} is the Vietnamese value (canonical) shown so the admin recognizes the record. */
    public record Item(String id, String slug, String name) {
    }
}
