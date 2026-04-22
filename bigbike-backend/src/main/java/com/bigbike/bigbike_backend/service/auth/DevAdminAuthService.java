package com.bigbike.bigbike_backend.service.auth;

import com.bigbike.bigbike_backend.api.error.AuthNotImplementedException;
import com.bigbike.bigbike_backend.api.error.ForbiddenException;
import com.bigbike.bigbike_backend.domain.auth.AdminPrincipal;
import com.bigbike.bigbike_backend.domain.auth.AdminUserProfile;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.core.env.Environment;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

@Service
public class DevAdminAuthService {

    private static final String HEADER_ROLE = "X-Admin-Role";
    private static final String HEADER_PERMISSIONS = "X-Admin-Permissions";
    private static final Set<String> DEV_MOCK_PROFILES = Set.of("dev", "mock", "test", "local");
    private static final Set<String> PROD_PROFILES = Set.of("prod", "production");
    private static final Map<String, List<String>> ROLE_PERMISSION_MAP = Map.of(
            "SUPER_ADMIN", List.of("*"),
            "ADMIN", List.of(
                    "products.read",
                    "products.update",
                    "catalog.read",
                    "catalog.update",
                    "content.read",
                    "content.update",
                    "orders.read",
                    "orders.write",
                    "customers.read",
                    "customers.write",
                    "media.read",
                    "media.write",
                    "redirects.read",
                    "redirects.write",
                    "settings.read",
                    "settings.write",
                    "menus.read",
                    "menus.write",
                    "coupons.read",
                    "coupons.write"
            ),
            "MANAGER", List.of("products.read", "catalog.read", "content.read"),
            "CONTENT_EDITOR", List.of("content.read", "content.update"),
            "VIEWER", List.of("products.read", "catalog.read", "content.read")
    );

    private final Environment environment;

    public DevAdminAuthService(Environment environment) {
        this.environment = environment;
    }

    public AdminUserProfile currentAdminUser(HttpServletRequest request) {
        ensureDevMockProfile();

        String role = resolveRole(request.getHeader(HEADER_ROLE));
        List<String> permissions = resolvePermissions(role, request.getHeader(HEADER_PERMISSIONS));
        Instant now = Instant.now();

        return new AdminUserProfile(
                "dev-admin-user",
                "BigBike Admin",
                "admin@bigbike.local",
                List.of(role),
                permissions,
                "ACTIVE",
                now,
                now
        );
    }

    /**
     * Checks that the caller has the required permission.
     *
     * When a real JWT principal is present in the SecurityContext (production path), the check
     * is based on the role's default permission set — headers are ignored.
     * When no JWT auth exists (dev/test bypass path), the legacy header-based logic is used.
     */
    public AdminUserProfile requirePermission(HttpServletRequest request, String requiredPermission) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof AdminPrincipal principal) {
            // JWT auth is present — use role-based permissions
            List<String> permissions = ROLE_PERMISSION_MAP.getOrDefault(
                    principal.role().toUpperCase(Locale.ROOT),
                    ROLE_PERMISSION_MAP.getOrDefault("ADMIN", List.of())
            );
            boolean granted = permissions.contains("*") || permissions.contains(requiredPermission);
            if (!granted) {
                throw new ForbiddenException("Permission denied.");
            }
            Instant now = Instant.now();
            return new AdminUserProfile(
                    principal.id(), "Admin", principal.email(),
                    List.of(principal.role()), permissions, "ACTIVE", now, now);
        }

        // Dev/test bypass path — reads X-Admin-Role and X-Admin-Permissions headers
        AdminUserProfile user = currentAdminUser(request);
        boolean granted = user.permissions().contains("*") || user.permissions().contains(requiredPermission);
        if (!granted) {
            throw new ForbiddenException("Permission denied.");
        }
        return user;
    }

    /** Returns default permissions for a given role string — used by other services. */
    public static List<String> defaultPermissionsForRole(String role) {
        if (role == null) return List.of();
        return ROLE_PERMISSION_MAP.getOrDefault(role.toUpperCase(Locale.ROOT), List.of());
    }

    private void ensureDevMockProfile() {
        String[] activeProfiles = environment.getActiveProfiles();
        if (activeProfiles.length == 0) {
            return;
        }

        Set<String> normalizedProfiles = Arrays.stream(activeProfiles)
                .map(profile -> profile.toLowerCase(Locale.ROOT))
                .collect(Collectors.toSet());

        boolean explicitProd = normalizedProfiles.stream().anyMatch(PROD_PROFILES::contains);
        boolean devMock = normalizedProfiles.stream().anyMatch(DEV_MOCK_PROFILES::contains);

        if (!devMock || explicitProd) {
            throw new AuthNotImplementedException(
                    "Production authentication is not implemented yet. Use dev/mock profile for placeholder auth."
            );
        }
    }

    private static String resolveRole(String roleHeader) {
        if (roleHeader == null || roleHeader.isBlank()) {
            return "ADMIN";
        }

        String normalized = roleHeader.trim().toUpperCase(Locale.ROOT);
        return ROLE_PERMISSION_MAP.containsKey(normalized) ? normalized : "ADMIN";
    }

    private static List<String> resolvePermissions(String role, String permissionsHeader) {
        if (permissionsHeader == null || permissionsHeader.isBlank()) {
            return ROLE_PERMISSION_MAP.getOrDefault(role, ROLE_PERMISSION_MAP.get("ADMIN"));
        }

        List<String> parsedPermissions = Arrays.stream(permissionsHeader.split(","))
                .map(String::trim)
                .filter(entry -> !entry.isEmpty())
                .distinct()
                .toList();

        if (parsedPermissions.isEmpty()) {
            return ROLE_PERMISSION_MAP.getOrDefault(role, ROLE_PERMISSION_MAP.get("ADMIN"));
        }

        return parsedPermissions;
    }
}
