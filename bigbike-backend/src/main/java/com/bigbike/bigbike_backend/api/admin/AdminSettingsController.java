package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.api.admin.dto.settings.AdminSiteSettingResponse;
import com.bigbike.bigbike_backend.api.admin.dto.settings.BatchUpdateSettingsRequest;
import com.bigbike.bigbike_backend.api.admin.dto.settings.UpdateSiteSettingRequest;
import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiListResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.service.admin.AdminSettingsService;
import com.bigbike.bigbike_backend.service.auth.DevAdminAuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.util.List;
import lombok.RequiredArgsConstructor;
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
@RequiredArgsConstructor
public class AdminSettingsController extends AdminControllerSupport {

    private final AdminSettingsService adminSettingsService;
    private final DevAdminAuthService devAdminAuthService;
    private final ApiResponseFactory apiResponseFactory;

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

    // GET /api/v1/admin/settings/{settingKey} removed 2026-07-15 (AUD-068, decision #8):
    // no UI caller — the settings screen loads the whole list via GET /admin/settings.

    @PatchMapping
    public ApiDataResponse<List<AdminSiteSettingResponse>> batchUpdateSettings(
            @Valid @RequestBody BatchUpdateSettingsRequest body,
            HttpServletRequest request
    ) {
        var profile = devAdminAuthService.requirePermission(request, "settings.write");
        boolean superAdmin = profile.permissions().contains("*");
        return apiResponseFactory.data(
                adminSettingsService.batchUpdateSettings(body.updates(), resolveAdminId(), superAdmin), request);
    }

    @PatchMapping("/{settingKey}")
    public ApiDataResponse<AdminSiteSettingResponse> updateSetting(
            @PathVariable String settingKey,
            @Valid @RequestBody UpdateSiteSettingRequest body,
            HttpServletRequest request
    ) {
        var profile = devAdminAuthService.requirePermission(request, "settings.write");
        boolean superAdmin = profile.permissions().contains("*");
        return apiResponseFactory.data(
                adminSettingsService.updateSetting(settingKey, resolveAdminId(), superAdmin, body), request);
    }

}
