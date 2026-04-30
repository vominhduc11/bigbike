package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.api.admin.dto.returns.AdminReturnDetailResponse;
import com.bigbike.bigbike_backend.api.admin.dto.returns.AdminReturnListItemResponse;
import com.bigbike.bigbike_backend.api.admin.dto.returns.UpdateReturnStatusRequest;
import com.bigbike.bigbike_backend.domain.auth.AdminPrincipal;
import com.bigbike.bigbike_backend.service.admin.AdminReturnService;
import com.bigbike.bigbike_backend.service.auth.DevAdminAuthService;
import com.bigbike.bigbike_backend.service.common.PageResult;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/returns")
public class AdminReturnController {

    private static final UUID DEV_ADMIN_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

    private final AdminReturnService adminReturnService;
    private final DevAdminAuthService devAdminAuthService;

    public AdminReturnController(
            AdminReturnService adminReturnService,
            DevAdminAuthService devAdminAuthService
    ) {
        this.adminReturnService = adminReturnService;
        this.devAdminAuthService = devAdminAuthService;
    }

    @GetMapping
    public PageResult<AdminReturnListItemResponse> listReturns(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String q,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "orders.read");
        return adminReturnService.listReturns(page, size, status, q);
    }

    @GetMapping("/{returnId}")
    public AdminReturnDetailResponse getReturn(
            @PathVariable UUID returnId,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "orders.read");
        return adminReturnService.getReturnDetail(returnId);
    }

    @PatchMapping("/{returnId}/status")
    public AdminReturnDetailResponse updateStatus(
            @PathVariable UUID returnId,
            @Valid @RequestBody UpdateReturnStatusRequest req,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "orders.write");
        return adminReturnService.updateStatus(returnId, resolveAdminId(), req);
    }

    private UUID resolveAdminId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof AdminPrincipal principal) {
            try { return UUID.fromString(principal.id()); } catch (Exception ignored) {}
        }
        return DEV_ADMIN_ID;
    }
}
