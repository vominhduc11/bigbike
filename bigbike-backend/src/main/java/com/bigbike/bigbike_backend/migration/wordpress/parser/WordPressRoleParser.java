package com.bigbike.bigbike_backend.migration.wordpress.parser;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Component;

/**
 * Parses WordPress serialized capability strings ({prefix}capabilities / wp_capabilities).
 * Example: a:1:{s:8:"customer";b:1;} → primaryRole=customer
 *
 * Privileged roles (administrator, editor, shop_manager, etc.) are flagged
 * so the customer mapper can exclude them from the import.
 */
@Component
public class WordPressRoleParser {

    static final Set<String> PRIVILEGED_ROLES = Set.of(
            "administrator", "editor", "author", "contributor",
            "shop_manager", "wpseo_manager", "wpseo_editor"
    );

    private static final List<String> ROLE_PRIORITY = List.of(
            "administrator", "editor", "shop_manager", "customer", "subscriber"
    );

    private final PhpSerializeParser phpParser;

    public WordPressRoleParser(PhpSerializeParser phpParser) {
        this.phpParser = phpParser;
    }

    public record ParsedRole(String primaryRole, List<String> allRoles, List<String> warnings) {
        public boolean isPrivileged() {
            return allRoles.stream().anyMatch(PRIVILEGED_ROLES::contains);
        }
    }

    /**
     * Parses a PHP-serialized capabilities string.
     * Returns a safe default (subscriber, non-privileged) on any parse failure.
     */
    public ParsedRole parse(String serialized) {
        List<String> warnings = new ArrayList<>();
        if (serialized == null || serialized.isBlank()) {
            return new ParsedRole("subscriber", List.of("subscriber"),
                    List.of("Empty wp_capabilities — treating as subscriber"));
        }
        try {
            PhpSerializeParser.ParseResult parsed = phpParser.parse(serialized);
            warnings.addAll(parsed.warnings());
            if (!(parsed.value() instanceof Map<?, ?> capMap)) {
                warnings.add("wp_capabilities is not a PHP array: "
                        + serialized.substring(0, Math.min(60, serialized.length())));
                return new ParsedRole("subscriber", List.of("subscriber"), warnings);
            }
            List<String> active = capMap.entrySet().stream()
                    .filter(e -> Boolean.TRUE.equals(e.getValue()))
                    .map(e -> String.valueOf(e.getKey()))
                    .toList();
            if (active.isEmpty()) {
                warnings.add("No active roles in wp_capabilities: "
                        + serialized.substring(0, Math.min(60, serialized.length())));
                return new ParsedRole("subscriber", List.of("subscriber"), warnings);
            }
            String primary = ROLE_PRIORITY.stream().filter(active::contains)
                    .findFirst().orElse(active.get(0));
            return new ParsedRole(primary, active, warnings);
        } catch (Exception e) {
            warnings.add("Failed to parse wp_capabilities: " + e.getMessage());
            return new ParsedRole("subscriber", List.of("subscriber"), warnings);
        }
    }

    public boolean isPrivileged(String serialized) {
        return parse(serialized).isPrivileged();
    }
}
