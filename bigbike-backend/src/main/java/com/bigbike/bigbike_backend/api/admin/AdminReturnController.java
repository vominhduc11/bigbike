package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.api.admin.dto.returns.AdminCreateReturnRequest;
import com.bigbike.bigbike_backend.api.admin.dto.returns.AdminReturnDetailResponse;
import com.bigbike.bigbike_backend.api.admin.dto.returns.AdminReturnListItemResponse;
import com.bigbike.bigbike_backend.api.admin.dto.returns.InspectReturnItemRequest;
import com.bigbike.bigbike_backend.api.admin.dto.returns.UpdateReturnStatusRequest;
import com.bigbike.bigbike_backend.service.admin.AdminReturnService;
import com.bigbike.bigbike_backend.service.auth.DevAdminAuthService;
import com.bigbike.bigbike_backend.service.common.PageResult;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.UUID;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/returns")
@RequiredArgsConstructor
public class AdminReturnController extends AdminControllerSupport {

    private final AdminReturnService adminReturnService;
    private final DevAdminAuthService devAdminAuthService;

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

    @PostMapping
    public AdminReturnDetailResponse createReturn(
            @Valid @RequestBody AdminCreateReturnRequest req,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "orders.write");
        return adminReturnService.adminCreateReturn(req, resolveAdminId());
    }

    @GetMapping("/by-order/{orderId}")
    public List<AdminReturnListItemResponse> listByOrder(
            @PathVariable UUID orderId,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "orders.read");
        return adminReturnService.listByOrderId(orderId);
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

    @PatchMapping("/{returnId}/items/{itemId}/inspect")
    public AdminReturnDetailResponse inspectItem(
            @PathVariable UUID returnId,
            @PathVariable UUID itemId,
            @Valid @RequestBody InspectReturnItemRequest req,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "orders.write");
        return adminReturnService.inspectItem(returnId, itemId, resolveAdminId(), req);
    }

}
