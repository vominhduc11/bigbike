package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.api.admin.dto.maintenance.AdminMaintenanceResponse;
import com.bigbike.bigbike_backend.api.admin.dto.maintenance.UpdateMaintenanceRequest;
import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.api.error.ForbiddenException;
import com.bigbike.bigbike_backend.service.auth.AdminAccountStatusService;
import com.bigbike.bigbike_backend.service.auth.DevAdminAuthService;
import com.bigbike.bigbike_backend.service.maintenance.MaintenanceService;
import com.bigbike.bigbike_backend.service.maintenance.MaintenanceStatus;
import com.bigbike.bigbike_backend.service.maintenance.MaintenanceUploadLeaseService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Admin-panel maintenance lock (BUSINESS_RULES {@code MAINTENANCE_RULE_006}).
 *
 * <p>Read is open to every signed-in admin — staff must be able to see why the panel is locked,
 * and {@code SecurityConfig} already restricts {@code /api/v1/admin/**} to authenticated
 * non-customers. Write is restricted to the {@code DEVELOPER} role.
 */
@RestController
@RequestMapping("/api/v1/admin/maintenance")
@RequiredArgsConstructor
public class AdminMaintenanceController extends AdminControllerSupport {

    private static final String DEVELOPER_ROLE = "DEVELOPER";
    private static final String STATUS_ACTIVE = "ACTIVE";
    private static final String SESSION_ATTR_ADMIN_USER_ID = "adminUserId";

    private final AdminAccountStatusService adminAccountStatusService;
    private final MaintenanceUploadLeaseService uploadLeaseService;
    private final MaintenanceService maintenanceService;
    private final DevAdminAuthService devAdminAuthService;
    private final ApiResponseFactory apiResponseFactory;

    @GetMapping
    public ApiDataResponse<AdminMaintenanceResponse> getMaintenance(HttpServletRequest request) {
        return apiResponseFactory.data(
                toResponse(maintenanceService.getStatus(), canToggle(resolveAdminRole())), request);
    }

    @PutMapping
    public ApiDataResponse<AdminMaintenanceResponse> updateMaintenance(
            @Valid @RequestBody UpdateMaintenanceRequest body,
            HttpServletRequest request
    ) {
        requireDeveloper(request);
        MaintenanceStatus status = maintenanceService.setState(
                body.state(), body.staffNote(), resolveAdminId());
        return apiResponseFactory.data(toResponse(status, true), request);
    }

    /**
     * Gates on the exact role name rather than a permission.
     *
     * <p>This is deliberate and load-bearing: {@code DevAdminAuthService.hasAnyPermission} returns
     * true unconditionally for any role holding {@code "*"}, so SUPER_ADMIN would automatically
     * hold any permission invented for this endpoint. The owner's decision (2026-08-06) is that
     * SUPER_ADMIN must NOT be able to toggle the lock, and a role-name check is the only construct
     * in this codebase that the wildcard cannot satisfy. Same shape as
     * {@code AdminReviewController.requireSuperAdminWithReviewsWrite}.
     *
     * <p>{@code maintenance.manage} is still required alongside it (V375) so the capability shows
     * up in the Roles screen instead of being invisible, and so this endpoint no longer borrows
     * an unrelated permission. {@code AdminRoleService} refuses to edit the DEVELOPER role's
     * permissions, so the pairing cannot be broken from the UI.
     */
    private void requireDeveloper(HttpServletRequest request) {
        var admin = devAdminAuthService.requirePermission(request, "maintenance.manage");
        if (admin.roles().stream().noneMatch(DEVELOPER_ROLE::equals)) {
            throw new ForbiddenException(
                    "Chỉ tài khoản kỹ thuật (DEVELOPER) mới được bật/tắt chế độ bảo trì.");
        }
    }

    private static boolean canToggle(String role) {
        return DEVELOPER_ROLE.equals(role);
    }

    private AdminMaintenanceResponse toResponse(MaintenanceStatus status, boolean canToggle) {
        return new AdminMaintenanceResponse(
                status.state(),
                status.staffNote(),
                status.updatedAt(),
                canToggle,
                uploadLeaseService.activity().count());
    }

    @MessageMapping("/admin/maintenance/uploads")
    public void updateUploadLease(
            UploadLeaseCommand command,
            SimpMessageHeaderAccessor accessor
    ) {
        Object rawUserId = accessor.getSessionAttributes() == null
                ? null : accessor.getSessionAttributes().get(SESSION_ATTR_ADMIN_USER_ID);
        UUID adminId = rawUserId instanceof UUID userId ? userId : null;
        if (adminId == null || !isActive(adminId) || command == null) {
            throw new IllegalArgumentException("Admin upload session is invalid.");
        }
        uploadLeaseService.update(adminId, command.uploadId(), command.status());
    }

    private boolean isActive(UUID adminId) {
        AdminAccountStatusService.Snapshot snapshot = adminAccountStatusService.getSnapshot(adminId);
        return snapshot != null && STATUS_ACTIVE.equals(snapshot.status());
    }

    public record UploadLeaseCommand(String uploadId, String status) {}
}
