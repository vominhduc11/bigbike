package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiListResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.api.error.UnauthorizedException;
import com.bigbike.bigbike_backend.config.ClientIpResolver;
import com.bigbike.bigbike_backend.domain.auth.AdminPrincipal;
import com.bigbike.bigbike_backend.service.admin.AdminAdminUsersService;
import com.bigbike.bigbike_backend.service.auth.DevAdminAuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/api/v1/admin/admin-users")
public class AdminAdminUsersController {

    private static final UUID DEV_ADMIN_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

    // RBAUD-009: devHeaderEnabled controls whether missing principal falls back to DEV_ADMIN_ID
    // (test/dev only) or throws UnauthorizedException (production default).
    @Value("${bigbike.auth.dev-header-enabled:false}")
    private boolean devHeaderEnabled;

    private final AdminAdminUsersService adminAdminUsersService;
    private final DevAdminAuthService devAdminAuthService;
    private final ApiResponseFactory apiResponseFactory;
    private final ClientIpResolver clientIpResolver;

    public AdminAdminUsersController(
            AdminAdminUsersService adminAdminUsersService,
            DevAdminAuthService devAdminAuthService,
            ApiResponseFactory apiResponseFactory,
            ClientIpResolver clientIpResolver
    ) {
        this.adminAdminUsersService = adminAdminUsersService;
        this.devAdminAuthService = devAdminAuthService;
        this.apiResponseFactory = apiResponseFactory;
        this.clientIpResolver = clientIpResolver;
    }

    @GetMapping
    public ApiListResponse<Map<String, Object>> listAdminUsers(
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String role,
            @RequestParam(required = false) String status,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "admin-users.read");
        return apiResponseFactory.list(adminAdminUsersService.listAdminUsers(page, size, q, role, status), request);
    }

    @GetMapping("/{id}")
    public ApiDataResponse<Map<String, Object>> getAdminUser(
            @PathVariable UUID id,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "admin-users.read");
        return apiResponseFactory.data(adminAdminUsersService.getAdminUser(id), request);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiDataResponse<Map<String, Object>> createAdminUser(
            @RequestBody Map<String, String> body,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "admin-users.write");
        String clientIp = clientIpResolver.resolve(request);
        String userAgent = request.getHeader("User-Agent");
        return apiResponseFactory.data(
                adminAdminUsersService.createAdminUser(
                        resolveAdminId(),
                        clientIp,
                        userAgent,
                        body.get("email"),
                        body.get("displayName"),
                        body.get("role"),
                        body.get("password")
                ),
                request
        );
    }

    @PatchMapping("/{id}")
    public ApiDataResponse<Map<String, Object>> updateAdminUser(
            @PathVariable UUID id,
            @RequestBody Map<String, String> body,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "admin-users.write");
        String clientIp = clientIpResolver.resolve(request);
        String userAgent = request.getHeader("User-Agent");
        return apiResponseFactory.data(
                adminAdminUsersService.updateAdminUser(
                        resolveAdminId(),
                        clientIp,
                        userAgent,
                        id,
                        body.get("displayName"),
                        body.get("status"),
                        body.get("newPassword"),
                        body.get("role")
                ),
                request
        );
    }

    /**
     * RBAUD-009: Resolves the authenticated admin UUID.
     * - Real JWT principal → use UUID from AdminPrincipal.
     * - devHeaderEnabled=true (test/dev) and no principal → fallback to DEV_ADMIN_ID.
     * - devHeaderEnabled=false (production) and no principal → throw UnauthorizedException.
     */
    private UUID resolveAdminId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof AdminPrincipal principal) {
            try {
                return UUID.fromString(principal.id());
            } catch (IllegalArgumentException ignored) {}
        }
        if (devHeaderEnabled) {
            return DEV_ADMIN_ID;
        }
        throw new UnauthorizedException("No authenticated admin principal.");
    }
}
