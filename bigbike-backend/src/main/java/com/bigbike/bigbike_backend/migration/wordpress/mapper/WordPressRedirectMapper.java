package com.bigbike.bigbike_backend.migration.wordpress.mapper;

import com.bigbike.bigbike_backend.migration.wordpress.model.WpRedirectRow;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class WordPressRedirectMapper {

    public record MappedRedirect(
            long sourceId,
            String sourcePattern,
            String targetPattern,
            int redirectCode,
            boolean enabled,
            List<String> warnings
    ) {}

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

    /**
     * Parse the RankMath sources JSON field to extract first source pattern.
     * RankMath stores: [{"pattern":"\/old-url","comparison":"exact"},...] or similar.
     * Phase 2A: minimal regex extraction, not a full JSON parser.
     */
    public static String parseFirstSourcePattern(String sourcesJson) {
        if (sourcesJson == null || sourcesJson.isBlank()) return "";
        // Extract first "pattern":"value" occurrence
        java.util.regex.Matcher m = java.util.regex.Pattern
                .compile("\"pattern\"\\s*:\\s*\"([^\"]+)\"")
                .matcher(sourcesJson);
        if (m.find()) {
            return m.group(1).replace("\\/", "/");
        }
        // Fallback: try raw URL if not JSON
        return sourcesJson.trim();
    }
}
