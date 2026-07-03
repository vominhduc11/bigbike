package com.bigbike.bigbike_backend.domain.menu;

import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;

/**
 * System-defined menu slots consumed by the public web frontend.
 *
 * <p>The web frontend (header, footer, guide widget, policy-page sidebar) only
 * renders menus that live at one of these locations. The {@code policy} slot
 * curates which CMS pages appear in the {@code /chinh-sach/...} sidebar and in
 * what order. Admin users must not be able to create new
 * locations through the public admin API because there is no UI mechanism to
 * surface them on the storefront — any extra menu would become orphan data.
 *
 * <p>Treat this set as the single source of truth: validation in
 * {@code AdminMenuService}, the seed migration, and the admin UI all derive
 * from it.
 */
public final class MenuLocations {

    public static final String PRIMARY = "primary";

    public static final Set<String> SYSTEM_LOCATIONS =
            Set.copyOf(new LinkedHashSet<>(Set.of(PRIMARY)));

    private MenuLocations() {}

    public static boolean isSystem(String location) {
        if (location == null) return false;
        return SYSTEM_LOCATIONS.contains(location.trim().toLowerCase(Locale.ROOT));
    }
}
