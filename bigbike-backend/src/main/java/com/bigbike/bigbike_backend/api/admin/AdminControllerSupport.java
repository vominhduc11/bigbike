package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.domain.auth.AdminPrincipal;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

/**
 * Shared helpers for admin controllers. Centralises the resolveAdminId()
 * pattern so it is not duplicated across every controller file.
 */
@Slf4j
public abstract class AdminControllerSupport {

    // Sentinel used in dev/test when there is no real JWT principal.
    // Matches the seed row created by DataInitializer.
    protected static final UUID DEV_ADMIN_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

    /**
     * Extracts the admin UUID from the current JWT principal.
     * Falls back to DEV_ADMIN_ID only when there is no principal (dev/test header-auth path).
     * Logs a WARN when the fallback is used so it is visible in prod logs if misconfigured.
     */
    protected UUID resolveAdminId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof AdminPrincipal principal) {
            try {
                return UUID.fromString(principal.id());
            } catch (IllegalArgumentException e) {
                // Non-UUID id (e.g. dev header "dev-admin-user") — fall through
                log.warn("Admin principal id '{}' is not a valid UUID; falling back to DEV_ADMIN_ID", principal.id());
            }
        } else {
            log.warn("No AdminPrincipal in SecurityContext; falling back to DEV_ADMIN_ID — check auth config if this appears in production logs");
        }
        return DEV_ADMIN_ID;
    }

    /**
     * Resolves the role of the current JWT admin principal (e.g. {@code SUPER_ADMIN}).
     * Returns {@code null} when there is no JWT principal (the dev/test header-auth path),
     * which callers treat as "skip privilege-tier guards" — that path is off in production
     * and is already governed by {@code DevAdminAuthService.requirePermission}.
     */
    protected String resolveAdminRole() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof AdminPrincipal principal) {
            return principal.role();
        }
        return null;
    }
}
