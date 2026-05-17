package com.bigbike.bigbike_backend.service.auth;

import com.bigbike.bigbike_backend.api.error.AuthNotImplementedException;
import com.bigbike.bigbike_backend.api.error.ForbiddenException;
import com.bigbike.bigbike_backend.api.error.UnauthorizedException;
import com.bigbike.bigbike_backend.domain.auth.AdminPrincipal;
import com.bigbike.bigbike_backend.domain.auth.AdminUserProfile;
import com.bigbike.bigbike_backend.domain.customer.CustomerPrincipal;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class DevAdminAuthService {

    private static final String HEADER_ROLE = "X-Admin-Role";
    private static final String HEADER_PERMISSIONS = "X-Admin-Permissions";
    private static final Set<String> DEV_MOCK_PROFILES = Set.of("dev", "mock", "test", "local");
    private static final Set<String> PROD_PROFILES = Set.of("prod", "production");

    private final Environment environment;
    private final AdminPermissionService adminPermissionService;

    @Value("${bigbike.auth.dev-header-enabled:false}")
    private boolean devHeaderEnabled;

    public AdminUserProfile currentAdminUser(HttpServletRequest request) {
        if (!devHeaderEnabled) {
            throw new UnauthorizedException("Dev header authentication is disabled.");
        }
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
     * When a real JWT principal is present in the SecurityContext (production path), permissions
     * are resolved from the DB via AdminPermissionService — headers are ignored.
     * When no JWT auth exists (dev/test bypass path), the legacy header-based logic is used.
     */
    public AdminUserProfile requirePermission(HttpServletRequest request, String requiredPermission) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof AdminPrincipal principal) {
            List<String> permissions = adminPermissionService.getPermissionsForRole(principal.role());
            boolean granted = permissions.contains("*") || permissions.contains(requiredPermission);
            if (!granted) {
                throw new ForbiddenException("Permission denied.");
            }
            Instant now = Instant.now();
            return new AdminUserProfile(
                    principal.id(), "Admin", principal.email(),
                    List.of(principal.role()), permissions, "ACTIVE", now, now);
        }

        // A logged-in customer must never fall through to the dev-header bypass below:
        // that path defaults the role to ADMIN and would escalate them to full admin.
        if (auth != null && auth.getPrincipal() instanceof CustomerPrincipal) {
            throw new UnauthorizedException("No authenticated admin principal.");
        }

        // Dev/test bypass path — only active when bigbike.auth.dev-header-enabled=true
        if (!devHeaderEnabled) {
            throw new UnauthorizedException("No authenticated admin principal.");
        }
        AdminUserProfile user = currentAdminUser(request);
        boolean granted = user.permissions().contains("*") || user.permissions().contains(requiredPermission);
        if (!granted) {
            throw new ForbiddenException("Permission denied.");
        }
        return user;
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
        return roleHeader.trim().toUpperCase(Locale.ROOT);
    }

    private List<String> resolvePermissions(String role, String permissionsHeader) {
        if (permissionsHeader != null && !permissionsHeader.isBlank()) {
            List<String> parsed = Arrays.stream(permissionsHeader.split(","))
                    .map(String::trim)
                    .filter(entry -> !entry.isEmpty())
                    .distinct()
                    .toList();
            if (!parsed.isEmpty()) {
                return parsed;
            }
        }
        return adminPermissionService.getPermissionsForRole(role);
    }
}
