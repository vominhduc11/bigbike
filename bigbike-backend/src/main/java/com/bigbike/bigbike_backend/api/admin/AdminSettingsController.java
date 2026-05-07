package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.api.admin.dto.settings.AdminSiteSettingResponse;
import com.bigbike.bigbike_backend.api.admin.dto.settings.BatchUpdateSettingsRequest;
import com.bigbike.bigbike_backend.api.admin.dto.settings.UpdateSiteSettingRequest;
import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiListResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.domain.auth.AdminPrincipal;
import com.bigbike.bigbike_backend.service.admin.AdminSettingsService;
import com.bigbike.bigbike_backend.service.auth.DevAdminAuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/api/v1/admin/settings")
public class AdminSettingsController {

    private static final UUID DEV_ADMIN_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

    private final AdminSettingsService adminSettingsService;
    private final DevAdminAuthService devAdminAuthService;
    private final ApiResponseFactory apiResponseFactory;

    public AdminSettingsController(
            AdminSettingsService adminSettingsService,
            DevAdminAuthService devAdminAuthService,
            ApiResponseFactory apiResponseFactory
    ) {
        this.adminSettingsService = adminSettingsService;
        this.devAdminAuthService = devAdminAuthService;
        this.apiResponseFactory = apiResponseFactory;
    }

    @GetMapping
    public ApiListResponse<AdminSiteSettingResponse> listSettings(
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(defaultValue = "50") @Min(1) @Max(200) int size,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String group,
            @RequestParam(required = false) Boolean isPublic,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "settings.read");
        return apiResponseFactory.list(
                adminSettingsService.listSettings(page, size, q, group, isPublic), request);
    }

    @GetMapping("/{settingKey}")
    public ApiDataResponse<AdminSiteSettingResponse> getByKey(
            @PathVariable String settingKey,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "settings.read");
        return apiResponseFactory.data(adminSettingsService.getByKey(settingKey), request);
    }

    @PatchMapping
    public ApiDataResponse<List<AdminSiteSettingResponse>> batchUpdateSettings(
            @RequestBody BatchUpdateSettingsRequest body,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "settings.write");
        return apiResponseFactory.data(
                adminSettingsService.batchUpdateSettings(body.updates(), resolveAdminId()), request);
    }

    @PatchMapping("/{settingKey}")
    public ApiDataResponse<AdminSiteSettingResponse> updateSetting(
            @PathVariable String settingKey,
            @RequestBody UpdateSiteSettingRequest body,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "settings.write");
        return apiResponseFactory.data(
                adminSettingsService.updateSetting(settingKey, resolveAdminId(), body), request);
    }

    private UUID resolveAdminId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof AdminPrincipal principal) {
            try { return UUID.fromString(principal.id()); } catch (IllegalArgumentException ignored) {}
        }
        return DEV_ADMIN_ID;
    }
}
