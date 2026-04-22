package com.bigbike.bigbike_backend.migration.wordpress.mapper;

import com.bigbike.bigbike_backend.migration.wordpress.parser.PhpSerializeParser;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * Parses the Permalink Manager Pro URI map stored in kd_options under the key
 * "permalink-manager_uris" (PHP serialized associative array).
 *
 * The map keys are post or term IDs (possibly prefixed with "tax-" for terms),
 * and the values are custom URI paths overriding the default WordPress permalink.
 *
 * Dry-run use:
 *   - Report how many custom URIs exist per content type
 *   - Detect conflicts (duplicate URI)
 *   - Flag URIs missing ".html" extension where BigBike expects it
 */
@Component
public class WordPressPermalinkManagerMapper {

    public record PermalinkEntry(
            String rawKey,
            String uri,
            EntryType type,
            long resolvedId
    ) {}

    public enum EntryType { POST, TERM, UNKNOWN }

    public record ParsedPermalinkMap(
            List<PermalinkEntry> entries,
            int postCount,
            int termCount,
            List<String> warnings,
            List<String> conflicts
    ) {}

    private final PhpSerializeParser phpParser;

    public WordPressPermalinkManagerMapper(PhpSerializeParser phpParser) {
        this.phpParser = phpParser;
    }

    public ParsedPermalinkMap parse(String serializedOptionValue) {
        List<String> warnings = new ArrayList<>();
        List<PermalinkEntry> entries = new ArrayList<>();

        if (serializedOptionValue == null || serializedOptionValue.isBlank()) {
            warnings.add("permalink-manager_uris option value is empty");
            return new ParsedPermalinkMap(entries, 0, 0, warnings, List.of());
        }

        PhpSerializeParser.ParseResult result = phpParser.parse(serializedOptionValue);
        warnings.addAll(result.warnings());

        if (!(result.value() instanceof Map<?, ?> rawMap)) {
            warnings.add("Expected PHP array for permalink-manager_uris, got: "
                    + (result.value() == null ? "null" : result.value().getClass().getSimpleName()));
            return new ParsedPermalinkMap(entries, 0, 0, warnings, List.of());
        }

        @SuppressWarnings("unchecked")
        Map<Object, Object> map = (Map<Object, Object>) rawMap;

        Map<String, Integer> uriCount = new LinkedHashMap<>();
        int postCount = 0;
        int termCount = 0;

        for (Map.Entry<Object, Object> entry : map.entrySet()) {
            String rawKey = entry.getKey() != null ? entry.getKey().toString() : "";
            String uri    = entry.getValue() != null ? entry.getValue().toString() : "";

            EntryType type;
            long id;
            if (rawKey.startsWith("tax-")) {
                type = EntryType.TERM;
                termCount++;
                try { id = Long.parseLong(rawKey.substring(4)); }
                catch (NumberFormatException e) { id = 0; }
            } else {
                type = EntryType.POST;
                postCount++;
                try { id = Long.parseLong(rawKey); }
                catch (NumberFormatException e) {
                    type = EntryType.UNKNOWN;
                    id = 0;
                    warnings.add("Unrecognised permalink map key: " + rawKey);
                }
            }

            if (uri.isBlank()) {
                warnings.add("Empty URI for key: " + rawKey);
            } else if (!uri.endsWith(".html") && !uri.equals("/")) {
                warnings.add("URI missing .html extension: " + uri + " (key=" + rawKey + ")");
            }

            uriCount.merge(uri, 1, Integer::sum);
            entries.add(new PermalinkEntry(rawKey, uri, type, id));
        }

        List<String> conflicts = uriCount.entrySet().stream()
                .filter(e -> e.getValue() > 1)
                .map(e -> "Duplicate URI: " + e.getKey() + " (count=" + e.getValue() + ")")
                .toList();

        return new ParsedPermalinkMap(entries, postCount, termCount, warnings, conflicts);
    }
}
