package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.api.admin.dto.settings.AdminProductAssignmentResponse;
import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.service.admin.AdminSettingsService;
import com.bigbike.bigbike_backend.service.auth.DevAdminAuthService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Read endpoint for the editable "Phân công" guide on the product create/edit screen.
 *
 * <p>Read is gated by {@code products.read} (not {@code settings.read}) so every role that can open
 * the product editor — SUPER_ADMIN, ADMIN, SHOP_MANAGER, EDITOR — can render the banner. Editing is
 * SUPER_ADMIN-only via the {@code superAdminOnly} {@code product_assign_*} settings keys
 * (see {@link AdminSettingsController}).
 */
@RestController
@RequestMapping("/api/v1/admin/product-assignment")
@RequiredArgsConstructor
public class AdminProductAssignmentController extends AdminControllerSupport {

    private final AdminSettingsService adminSettingsService;
    private final DevAdminAuthService devAdminAuthService;
    private final ApiResponseFactory apiResponseFactory;

    @GetMapping
    public ApiDataResponse<AdminProductAssignmentResponse> getProductAssignment(HttpServletRequest request) {
        devAdminAuthService.requirePermission(request, "products.read");
        return apiResponseFactory.data(adminSettingsService.getProductAssignment(), request);
    }
}
