package com.bigbike.bigbike_backend.service.admin;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;

/**
 * Serialize / parse the {@code en_overrides} column (V296): a JSON array of English
 * field/section keys an admin edited by hand. Stored as opaque text; the backend never
 * interprets the keys — it just round-trips them between the admin form and the DB so the
 * editor knows which English fields to LOCK (skip auto-translation) after a reload.
 */
public final class EnOverridesCodec {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final TypeReference<List<String>> LIST_OF_STRING = new TypeReference<>() {};

    private EnOverridesCodec() {}

    /** Parse stored JSON text into a list of keys; null/blank/garbage → empty list. */
    public static List<String> toList(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            List<String> parsed = MAPPER.readValue(json, LIST_OF_STRING);
            return parsed == null ? List.of() : parsed;
        } catch (Exception e) {
            return List.of();
        }
    }

    /** Serialize keys to JSON text for storage; null/empty → null (column stays NULL). */
    public static String toJson(List<String> keys) {
        if (keys == null || keys.isEmpty()) {
            return null;
        }
        // De-dupe, preserve order, drop blanks.
        List<String> clean = new ArrayList<>(new LinkedHashSet<>(keys.stream()
                .filter(k -> k != null && !k.isBlank())
                .map(String::trim)
                .toList()));
        if (clean.isEmpty()) {
            return null;
        }
        try {
            return MAPPER.writeValueAsString(clean);
        } catch (Exception e) {
            return null;
        }
    }
}
