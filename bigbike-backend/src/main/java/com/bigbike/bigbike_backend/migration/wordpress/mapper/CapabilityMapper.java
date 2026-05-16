package com.bigbike.bigbike_backend.migration.wordpress.mapper;

import com.bigbike.bigbike_backend.domain.auth.AdminRole;
import com.bigbike.bigbike_backend.migration.wordpress.parser.PhpSerializeParser;
import java.util.EnumSet;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Parses a PHP-serialized {@code wp_capabilities} / {@code {prefix}capabilities}
 * string into a canonical {@code Set<String>} of capability keys, and maps those
 * capabilities to one or more {@link AdminRole} values according to
 * docs/PERMISSION_MATRIX.md.
 *
 * This operates on the same raw input as {@link com.bigbike.bigbike_backend.migration.wordpress.parser.WordPressRoleParser},
 * but the output is the AdminRole enum rather than the raw WP role slug. Use this
 * when importing privileged users into {@code admin_users}.
 */
@Component
@RequiredArgsConstructor
public class CapabilityMapper {

    private final PhpSerializeParser phpParser;

    public record Mapped(Set<String> capabilities, Set<AdminRole> roles) {
        public boolean isEmpty() {
            return roles.isEmpty();
        }
    }

    /**
     * Parse a serialized wp_capabilities blob and map the active capabilities
     * to AdminRole(s). Unknown / empty capabilities yield an empty result.
     */
    public Mapped map(String serialized) {
        Set<String> caps = parseCapabilities(serialized);
        Set<AdminRole> roles = toRoles(caps);
        return new Mapped(caps, roles);
    }

    /** Parse serialized PHP array → active capability keys (where value is truthy). */
    public Set<String> parseCapabilities(String serialized) {
        Set<String> result = new LinkedHashSet<>();
        if (serialized == null || serialized.isBlank()) {
            return result;
        }
        PhpSerializeParser.ParseResult parsed = phpParser.parse(serialized);
        if (!(parsed.value() instanceof Map<?, ?> capMap)) {
            return result;
        }
        for (Map.Entry<?, ?> entry : capMap.entrySet()) {
            if (Boolean.TRUE.equals(entry.getValue())) {
                result.add(String.valueOf(entry.getKey()));
            }
        }
        return result;
    }

    /**
     * Map capability keys to AdminRole(s). A user can hold multiple roles
     * (e.g. shop_manager + wpseo_editor). The canonical WP role slugs are
     * handled; higher-granularity capabilities fall back to ADMIN.
     */
    public Set<AdminRole> toRoles(Set<String> capabilities) {
        Set<AdminRole> roles = EnumSet.noneOf(AdminRole.class);
        if (capabilities == null || capabilities.isEmpty()) {
            return roles;
        }
        for (String cap : capabilities) {
            switch (cap) {
                case "super_admin" -> roles.add(AdminRole.SUPER_ADMIN);
                case "administrator" -> roles.add(AdminRole.ADMIN);
                case "editor" -> roles.add(AdminRole.EDITOR);
                case "shop_manager" -> roles.add(AdminRole.SHOP_MANAGER);
                case "author" -> roles.add(AdminRole.AUTHOR);
                case "contributor" -> roles.add(AdminRole.CONTRIBUTOR);
                case "wpseo_editor", "wpseo_manager" -> roles.add(AdminRole.SEO_EDITOR);
                default -> {
                    // Capability-level grants that still imply a privileged user.
                    // manage_options is admin-only per PERMISSION_MATRIX.md §4.
                    if ("manage_options".equals(cap)) {
                        roles.add(AdminRole.ADMIN);
                    } else if ("manage_woocommerce".equals(cap) && roles.isEmpty()) {
                        roles.add(AdminRole.SHOP_MANAGER);
                    }
                }
            }
        }
        return roles;
    }
}
