package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.service.auth.DevAdminAuthService;
import com.bigbike.bigbike_backend.service.auth.PermissionCatalog;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Serves the canonical permission catalog so the FE RolesScreen does not need
 * to hardcode permission keys or groups.
 */
@RestController
@RequestMapping("/api/v1/admin/permissions")
@RequiredArgsConstructor
public class AdminPermissionsController {

    private final DevAdminAuthService devAdminAuthService;
    private final ApiResponseFactory apiResponseFactory;

    @GetMapping
    public ApiDataResponse<List<PermissionCatalog.Group>> listPermissions(HttpServletRequest request) {
        devAdminAuthService.requirePermission(request, "roles.read");
        return apiResponseFactory.data(PermissionCatalog.GROUPS, request);
    }
}
