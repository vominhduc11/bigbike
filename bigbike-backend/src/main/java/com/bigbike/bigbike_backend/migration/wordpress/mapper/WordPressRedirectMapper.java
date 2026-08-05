package com.bigbike.bigbike_backend.migration.wordpress.mapper;

import com.bigbike.bigbike_backend.migration.wordpress.model.WpRedirectRow;
import com.bigbike.bigbike_backend.migration.wordpress.parser.PhpSerializeParser;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

@Component
public class WordPressRedirectMapper {

    private static final ObjectMapper JSON = new ObjectMapper();

    public record MappedRedirect(
            long sourceId,
            String sourcePattern,
            String targetPattern,
            int redirectCode,
            boolean enabled,
            List<String> warnings
    ) {}

    public record ParsedSourcePatterns(List<String> patterns, List<String> warnings) {}

    public MappedRedirect map(WpRedirectRow row) {
        List<String> warnings = new ArrayList<>();

        String source = row.sourcePattern();
        if (source == null || source.isBlank()) {
            warnings.add("Empty sourcePattern for redirect id=" + row.id());
        }

        String target = row.urlTo();
        if (target == null || target.isBlank()) {
            warnings.add("Empty url_to for redirect id=" + row.id());
        }

        int code = row.headerCode();
        if (code != 301 && code != 302 && code != 307 && code != 410 && code != 451) {
            warnings.add("Non-standard redirect code " + code + " for id=" + row.id());
        }

        boolean enabled = "active".equalsIgnoreCase(row.status());

        return new MappedRedirect(row.id(), source, target, code, enabled, warnings);
    }

    /** Returns every exact source path from either RankMath JSON or PHP serialize() storage. */
    public static ParsedSourcePatterns parseSourcePatterns(String rawSources) {
        if (rawSources == null || rawSources.isBlank()) {
            return new ParsedSourcePatterns(List.of(), List.of("RankMath sources is blank"));
        }

        String source = rawSources.trim();
        LinkedHashSet<String> patterns = new LinkedHashSet<>();
        List<String> warnings = new ArrayList<>();
        if (source.startsWith("a:")) {
            PhpSerializeParser.ParseResult parsed = new PhpSerializeParser().parse(source);
            warnings.addAll(parsed.warnings());
            collectPhpPatterns(parsed.value(), patterns, warnings);
        } else if (source.startsWith("[") || source.startsWith("{")) {
            try {
                collectJsonPatterns(JSON.readTree(source), patterns, warnings);
            } catch (Exception e) {
                warnings.add("RankMath JSON parse failed: " + e.getMessage());
            }
        } else {
            patterns.add(source);
        }

        if (patterns.isEmpty()) warnings.add("No exact RankMath source pattern was parsed");
        return new ParsedSourcePatterns(List.copyOf(patterns), List.copyOf(warnings));
    }

    public static String parseFirstSourcePattern(String sourcesJson) {
        List<String> patterns = parseSourcePatterns(sourcesJson).patterns();
        return patterns.isEmpty() ? "" : patterns.get(0);
    }

    private static void collectPhpPatterns(
            Object value, LinkedHashSet<String> patterns, List<String> warnings) {
        if (!(value instanceof Map<?, ?> map)) return;
        Object pattern = map.get("pattern");
        if (pattern instanceof String text && !text.isBlank()) {
            Object comparison = map.get("comparison");
            if (comparison == null || "exact".equalsIgnoreCase(comparison.toString())) {
                patterns.add(text.trim());
            } else {
                warnings.add("Skipped non-exact RankMath source pattern: " + text);
            }
            return;
        }
        for (Object nested : map.values()) collectPhpPatterns(nested, patterns, warnings);
    }

    private static void collectJsonPatterns(
            JsonNode value, LinkedHashSet<String> patterns, List<String> warnings) {
        if (value == null || value.isNull()) return;
        if (value.isArray()) {
            value.forEach(node -> collectJsonPatterns(node, patterns, warnings));
            return;
        }
        if (!value.isObject()) return;
        JsonNode pattern = value.get("pattern");
        if (pattern != null && pattern.isTextual() && !pattern.asText().isBlank()) {
            JsonNode comparison = value.get("comparison");
            if (comparison == null || comparison.isNull()
                    || "exact".equalsIgnoreCase(comparison.asText())) {
                patterns.add(pattern.asText().trim());
            } else {
                warnings.add("Skipped non-exact RankMath source pattern: " + pattern.asText());
            }
            return;
        }
        value.elements().forEachRemaining(node -> collectJsonPatterns(node, patterns, warnings));
    }
}
