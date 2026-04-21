package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.api.admin.dto.redirect.AdminRedirectDetailResponse;
import com.bigbike.bigbike_backend.api.admin.dto.redirect.AdminRedirectListItemResponse;
import com.bigbike.bigbike_backend.api.admin.dto.redirect.CreateRedirectRequest;
import com.bigbike.bigbike_backend.api.admin.dto.redirect.UpdateRedirectEnabledRequest;
import com.bigbike.bigbike_backend.api.admin.dto.redirect.UpdateRedirectRequest;
import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiListResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.domain.auth.AdminPrincipal;
import com.bigbike.bigbike_backend.service.admin.AdminRedirectService;
import com.bigbike.bigbike_backend.service.auth.DevAdminAuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
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
@RequestMapping("/api/v1/admin/redirects")
public class AdminRedirectController {

    private static final UUID DEV_ADMIN_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

    private final AdminRedirectService adminRedirectService;
    private final DevAdminAuthService devAdminAuthService;
    private final ApiResponseFactory apiResponseFactory;

    public AdminRedirectController(
            AdminRedirectService adminRedirectService,
            DevAdminAuthService devAdminAuthService,
            ApiResponseFactory apiResponseFactory
    ) {
        this.adminRedirectService = adminRedirectService;
        this.devAdminAuthService = devAdminAuthService;
        this.apiResponseFactory = apiResponseFactory;
    }

    @GetMapping
    public ApiListResponse<AdminRedirectListItemResponse> listRedirects(
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Boolean enabled,
            @RequestParam(required = false) Integer statusCode,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "redirects.read");
        return apiResponseFactory.list(
                adminRedirectService.listRedirects(page, size, q, enabled, statusCode), request);
    }

    @GetMapping("/{redirectId}")
    public ApiDataResponse<AdminRedirectDetailResponse> getRedirectDetail(
            @PathVariable UUID redirectId,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "redirects.read");
        return apiResponseFactory.data(adminRedirectService.getRedirectDetail(redirectId), request);
    }

    @PostMapping
    public ApiDataResponse<AdminRedirectDetailResponse> createRedirect(
            @Valid @RequestBody CreateRedirectRequest body,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "redirects.write");
        return apiResponseFactory.data(
                adminRedirectService.createRedirect(resolveAdminId(), body), request);
    }

    @PatchMapping("/{redirectId}")
    public ApiDataResponse<AdminRedirectDetailResponse> updateRedirect(
            @PathVariable UUID redirectId,
            @Valid @RequestBody UpdateRedirectRequest body,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "redirects.write");
        return apiResponseFactory.data(
                adminRedirectService.updateRedirect(redirectId, resolveAdminId(), body), request);
    }

    @PatchMapping("/{redirectId}/enabled")
    public ApiDataResponse<AdminRedirectDetailResponse> updateEnabled(
            @PathVariable UUID redirectId,
            @Valid @RequestBody UpdateRedirectEnabledRequest body,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "redirects.write");
        return apiResponseFactory.data(
                adminRedirectService.updateEnabled(redirectId, resolveAdminId(), body), request);
    }

    @DeleteMapping("/{redirectId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteRedirect(
            @PathVariable UUID redirectId,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "redirects.write");
        adminRedirectService.deleteRedirect(redirectId, resolveAdminId());
    }

    private UUID resolveAdminId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof AdminPrincipal principal) {
            try { return UUID.fromString(principal.id()); } catch (IllegalArgumentException ignored) {}
        }
        return DEV_ADMIN_ID;
    }
}
