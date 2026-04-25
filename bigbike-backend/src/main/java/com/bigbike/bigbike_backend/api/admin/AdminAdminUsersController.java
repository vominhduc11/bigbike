package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiListResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.service.admin.AdminAdminUsersService;
import com.bigbike.bigbike_backend.service.auth.DevAdminAuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.util.Map;
import java.util.UUID;
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
@RequestMapping("/api/v1/admin/admin-users")
public class AdminAdminUsersController {

    private final AdminAdminUsersService adminAdminUsersService;
    private final DevAdminAuthService devAdminAuthService;
    private final ApiResponseFactory apiResponseFactory;

    public AdminAdminUsersController(
            AdminAdminUsersService adminAdminUsersService,
            DevAdminAuthService devAdminAuthService,
            ApiResponseFactory apiResponseFactory
    ) {
        this.adminAdminUsersService = adminAdminUsersService;
        this.devAdminAuthService = devAdminAuthService;
        this.apiResponseFactory = apiResponseFactory;
    }

    @GetMapping
    public ApiListResponse<Map<String, Object>> listAdminUsers(
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size,
            @RequestParam(required = false) String q,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "admin-users.read");
        return apiResponseFactory.list(adminAdminUsersService.listAdminUsers(page, size, q), request);
    }

    @GetMapping("/{id}")
    public ApiDataResponse<Map<String, Object>> getAdminUser(
            @PathVariable UUID id,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "admin-users.read");
        return apiResponseFactory.data(adminAdminUsersService.getAdminUser(id), request);
    }

    @PatchMapping("/{id}")
    public ApiDataResponse<Map<String, Object>> updateAdminUser(
            @PathVariable UUID id,
            @RequestBody Map<String, String> body,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "admin-users.write");
        return apiResponseFactory.data(
                adminAdminUsersService.updateAdminUser(
                        id,
                        body.get("displayName"),
                        body.get("status"),
                        body.get("newPassword")
                ),
                request
        );
    }
}
