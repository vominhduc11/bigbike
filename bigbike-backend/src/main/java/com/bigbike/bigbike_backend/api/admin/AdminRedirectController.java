package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiListResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.domain.auth.AdminPrincipal;
import com.bigbike.bigbike_backend.service.admin.AdminRedirectService;
import com.bigbike.bigbike_backend.service.auth.DevAdminAuthService;
import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
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
@RequiredArgsConstructor
public class AdminRedirectController {

    private static final UUID DEV_ADMIN_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

    private final AdminRedirectService adminRedirectService;
    private final DevAdminAuthService devAdminAuthService;
    private final ApiResponseFactory apiResponseFactory;

    public record CreateRedirectRequest(
            @NotBlank @Size(max = 1024) String sourcePattern,
            @NotBlank @Size(max = 2048) String targetUrl,
            @Size(max = 32) String redirectType,
            @Min(100) @Max(599) Integer statusCode,
            @JsonAlias("isEnabled")
            Boolean enabled,
            @Size(max = 2000) String notes,
            Long legacyId
    ) {}

    public record UpdateRedirectRequest(
            @Size(max = 1024)
            String sourcePattern,
            @Size(max = 2048)
            String targetUrl,
            @Size(max = 32)
            String redirectType,
            @Min(100) @Max(599)
            Integer statusCode,
            @JsonAlias("isEnabled")
            Boolean enabled,
            @Size(max = 2000)
            String notes,
            Long legacyId
    ) {}

    @GetMapping
    public ApiListResponse<AdminRedirectService.AdminRedirectResponse> listRedirects(
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Boolean enabled,
            @RequestParam(required = false) Integer statusCode,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "redirects.read");
        return apiResponseFactory.list(
                adminRedirectService.listRedirects(page, size, q, enabled, statusCode),
                request
        );
    }

    @GetMapping("/{id}")
    public ApiDataResponse<AdminRedirectService.AdminRedirectResponse> getRedirect(
            @PathVariable UUID id,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "redirects.read");
        return apiResponseFactory.data(adminRedirectService.getRedirect(id), request);
    }

    @PostMapping
    public ApiDataResponse<AdminRedirectService.AdminRedirectResponse> createRedirect(
            @Valid @RequestBody CreateRedirectRequest payload,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "redirects.write");
        return apiResponseFactory.data(
                adminRedirectService.createRedirect(resolveAdminId(), new AdminRedirectService.CreateRedirectRequest(
                        payload.sourcePattern(),
                        payload.targetUrl(),
                        payload.redirectType(),
                        payload.statusCode(),
                        payload.enabled(),
                        payload.notes(),
                        payload.legacyId()
                )),
                request
        );
    }

    @PatchMapping("/{id}")
    public ApiDataResponse<AdminRedirectService.AdminRedirectResponse> updateRedirect(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateRedirectRequest payload,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "redirects.write");
        return apiResponseFactory.data(
                adminRedirectService.updateRedirect(id, resolveAdminId(), new AdminRedirectService.UpdateRedirectRequest(
                        payload.sourcePattern(),
                        payload.targetUrl(),
                        payload.redirectType(),
                        payload.statusCode(),
                        payload.enabled(),
                        payload.notes(),
                        payload.legacyId()
                )),
                request
        );
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteRedirect(
            @PathVariable UUID id,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "redirects.write");
        adminRedirectService.deleteRedirect(id, resolveAdminId());
    }

    private UUID resolveAdminId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof AdminPrincipal principal) {
            try {
                return UUID.fromString(principal.id());
            } catch (IllegalArgumentException ignored) {
                // fall through to dev placeholder
            }
        }
        return DEV_ADMIN_ID;
    }
}
