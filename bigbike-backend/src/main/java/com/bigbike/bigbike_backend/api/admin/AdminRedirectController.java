package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.api.admin.dto.redirect.AdminRedirectResponse;
import com.bigbike.bigbike_backend.api.admin.dto.redirect.CreateRedirectRequest;
import com.bigbike.bigbike_backend.api.admin.dto.redirect.UpdateRedirectRequest;
import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiListResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.service.admin.AdminRedirectService;
import com.bigbike.bigbike_backend.service.auth.DevAdminAuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
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
public class AdminRedirectController extends AdminControllerSupport {

    private final AdminRedirectService adminRedirectService;
    private final DevAdminAuthService devAdminAuthService;
    private final ApiResponseFactory apiResponseFactory;

    @GetMapping
    public ApiListResponse<AdminRedirectResponse> listRedirects(
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
    public ApiDataResponse<AdminRedirectResponse> getRedirect(
            @PathVariable UUID id,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "redirects.read");
        return apiResponseFactory.data(adminRedirectService.getRedirect(id), request);
    }

    @PostMapping
    public ApiDataResponse<AdminRedirectResponse> createRedirect(
            @Valid @RequestBody CreateRedirectRequest payload,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "redirects.write");
        return apiResponseFactory.data(
                adminRedirectService.createRedirect(resolveAdminId(), payload),
                request
        );
    }

    @PatchMapping("/{id}")
    public ApiDataResponse<AdminRedirectResponse> updateRedirect(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateRedirectRequest payload,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "redirects.write");
        return apiResponseFactory.data(
                adminRedirectService.updateRedirect(id, resolveAdminId(), payload),
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

}
