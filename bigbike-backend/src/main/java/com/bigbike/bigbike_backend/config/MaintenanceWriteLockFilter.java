package com.bigbike.bigbike_backend.config;

import com.bigbike.bigbike_backend.api.common.ApiError;
import com.bigbike.bigbike_backend.api.common.ApiErrorResponse;
import com.bigbike.bigbike_backend.api.common.ApiMetaFactory;
import com.bigbike.bigbike_backend.domain.auth.AdminPrincipal;
import com.bigbike.bigbike_backend.service.maintenance.MaintenanceService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import tools.jackson.databind.ObjectMapper;

/**
 * Rejects admin write operations while maintenance is {@code ACTIVE}
 * (BUSINESS_RULES {@code MAINTENANCE_RULE_004}).
 *
 * <p>A filter rather than a per-controller guard: ~81 admin write endpoints exist and adding a
 * call to each is a guarantee of missing one. This is the single choke point that covers them all.
 *
 * <p><b>Returns 423 LOCKED, never 503.</b> {@code deploy/nginx/api.bigbike.vn.conf} declares
 * {@code error_page 502 503 504} with {@code proxy_intercept_errors on}, so nginx replaces the
 * body of any upstream 503 with its static outage JSON — which has no {@code error.code} field.
 * A 503 here would therefore reach the admin as an unrecognisable payload in production while
 * passing every local and MockMvc test. 423 is not intercepted, and is semantically correct.
 *
 * <p><b>Registered as a bare {@code @Component} + {@code addFilterAfter}, with no {@code @Order}</b>
 * — matching every other filter here. Spring Boot also auto-registers {@code @Component} filters
 * into the raw servlet chain; that copy is harmless only because it runs after
 * {@code springSecurityFilterChain} (order {@code -100}). An {@code @Order} below that would run
 * the copy first, where the {@code SecurityContext} is still empty: it would pass the request
 * through, mark it already-filtered, and the real copy would be skipped — a lock that silently
 * never engages.
 */
@Component
@RequiredArgsConstructor
public class MaintenanceWriteLockFilter extends OncePerRequestFilter {

    static final String ADMIN_PATH_PREFIX = "/api/v1/admin/";
    static final String ERROR_CODE = "MAINTENANCE_ACTIVE";
    private static final String DEVELOPER_ROLE = "DEVELOPER";
    private static final Set<String> SAFE_METHODS = Set.of("GET", "HEAD", "OPTIONS");

    /**
     * POSTs that only compute and return a result without persisting anything, plus the unlock
     * endpoint itself. Everything else under the admin prefix is treated as a mutation.
     *
     * <p>{@code POST /api/v1/admin/products/import/validate} is deliberately NOT listed: it only
     * precedes a {@code commit} that is blocked anyway, so failing at validate is the honest answer.
     */
    private static final Set<String> READ_SHAPED_POSTS = Set.of(
            "/api/v1/admin/products/preview",
            "/api/v1/admin/categories/permanent-delete-impact",
            "/api/v1/admin/content/articles/preview"
    );

    private static final String MAINTENANCE_ENDPOINT = "/api/v1/admin/maintenance";

    private final MaintenanceService maintenanceService;
    private final ObjectMapper objectMapper;
    private final ApiMetaFactory apiMetaFactory;

    /** Kill switch. Set {@code BIGBIKE_MAINTENANCE_LOCK_ENABLED=false} to disable the lock entirely. */
    @Value("${bigbike.maintenance.lock-enabled:true}")
    private boolean lockEnabled;

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        if (isAllowed(request)) {
            filterChain.doFilter(request, response);
            return;
        }

        response.setStatus(HttpStatus.LOCKED.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        ApiErrorResponse body = new ApiErrorResponse(
                new ApiError(ERROR_CODE,
                        "Trang quản trị đang bảo trì, thao tác chưa được lưu. Vui lòng thử lại sau.",
                        List.of()),
                apiMetaFactory.from(request));
        response.getWriter().write(objectMapper.writeValueAsString(body));
    }

    private boolean isAllowed(HttpServletRequest request) {
        if (!lockEnabled) return true;

        String uri = request.getRequestURI();
        if (!uri.startsWith(ADMIN_PATH_PREFIX)) return true;
        if (SAFE_METHODS.contains(request.getMethod())) return true;

        // No admin principal → let the chain answer. This filter runs before Spring Security's
        // AuthorizationFilter, so blocking here would turn an unauthenticated request into 423
        // instead of the 401 the auth contract (and AdminAuthSecurityTest) requires. A logged-in
        // customer likewise falls through so the URL rule can 403 it.
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof AdminPrincipal principal)) return true;

        // The developer who owns the lock keeps working — and, critically, keeps the ability to
        // release it. Gated on the exact role name, not a permission: SUPER_ADMIN's '*' short-
        // circuits every permission check (DevAdminAuthService.hasAnyPermission), so a permission
        // could never express "developer only".
        if (DEVELOPER_ROLE.equals(principal.role())) return true;

        if (READ_SHAPED_POSTS.contains(uri)) return true;
        if (MAINTENANCE_ENDPOINT.equals(uri)) return true;

        return !maintenanceService.isLocked();
    }
}
