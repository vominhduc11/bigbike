package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.config.ClientIpResolver;
import com.bigbike.bigbike_backend.service.admin.AdminRoleService;
import com.bigbike.bigbike_backend.service.auth.DevAdminAuthService;
import jakarta.servlet.http.HttpServletRequest;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/roles")
@RequiredArgsConstructor
public class AdminRolesController extends AdminControllerSupport {

    private final AdminRoleService adminRoleService;
    private final DevAdminAuthService devAdminAuthService;
    private final ApiResponseFactory apiResponseFactory;
    private final ClientIpResolver clientIpResolver;

    @GetMapping
    public ApiDataResponse<List<Map<String, Object>>> listRoles(HttpServletRequest request) {
        devAdminAuthService.requirePermission(request, "roles.read");
        return apiResponseFactory.data(adminRoleService.getAllRoles(), request);
    }

    @PutMapping("/{id}/permissions")
    public ApiDataResponse<Map<String, Object>> updatePermissions(
            @PathVariable String id,
            @RequestBody Map<String, Object> body,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "roles.write");
        String clientIp = clientIpResolver.resolve(request);
        String userAgent = request.getHeader("User-Agent");

        @SuppressWarnings("unchecked")
        List<String> permList = (List<String>) body.get("permissions");
        var permissions = new LinkedHashSet<>(permList != null ? permList : List.of());

        return apiResponseFactory.data(
                adminRoleService.updateRolePermissions(id, permissions, resolveAdminId(), clientIp, userAgent),
                request
        );
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiDataResponse<Map<String, Object>> createRole(
            @RequestBody Map<String, Object> body,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "roles.write");
        String clientIp = clientIpResolver.resolve(request);
        String userAgent = request.getHeader("User-Agent");

        @SuppressWarnings("unchecked")
        List<String> permList = (List<String>) body.get("permissions");
        var permissions = new LinkedHashSet<>(permList != null ? permList : List.of());

        return apiResponseFactory.data(
                adminRoleService.createRole(
                        (String) body.get("id"),
                        (String) body.get("name"),
                        (String) body.getOrDefault("description", ""),
                        permissions,
                        resolveAdminId(),
                        clientIp,
                        userAgent
                ),
                request
        );
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteRole(@PathVariable String id, HttpServletRequest request) {
        devAdminAuthService.requirePermission(request, "roles.write");
        String clientIp = clientIpResolver.resolve(request);
        String userAgent = request.getHeader("User-Agent");
        adminRoleService.deleteRole(id, resolveAdminId(), clientIp, userAgent);
    }

}
