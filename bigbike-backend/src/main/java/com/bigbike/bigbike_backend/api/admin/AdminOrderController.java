package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.api.admin.dto.order.AdminOrderDetailResponse;
import com.bigbike.bigbike_backend.api.admin.dto.order.AdminOrderListItemResponse;
import com.bigbike.bigbike_backend.api.admin.dto.order.AdminOrderNoteResponse;
import com.bigbike.bigbike_backend.api.admin.dto.order.CreateOrderNoteRequest;
import com.bigbike.bigbike_backend.api.admin.dto.order.CreateRefundRequest;
import com.bigbike.bigbike_backend.api.admin.dto.order.UpdateOrderStatusRequest;
import com.bigbike.bigbike_backend.api.admin.dto.order.UpdatePaymentStatusRequest;
import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiListResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.domain.auth.AdminPrincipal;
import com.bigbike.bigbike_backend.service.admin.AdminOrderService;
import com.bigbike.bigbike_backend.service.auth.DevAdminAuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
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
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/api/v1/admin/orders")
public class AdminOrderController {

    private static final UUID DEV_ADMIN_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

    private final AdminOrderService adminOrderService;
    private final DevAdminAuthService devAdminAuthService;
    private final ApiResponseFactory apiResponseFactory;

    public AdminOrderController(
            AdminOrderService adminOrderService,
            DevAdminAuthService devAdminAuthService,
            ApiResponseFactory apiResponseFactory
    ) {
        this.adminOrderService = adminOrderService;
        this.devAdminAuthService = devAdminAuthService;
        this.apiResponseFactory = apiResponseFactory;
    }

    @GetMapping
    public ApiListResponse<AdminOrderListItemResponse> listOrders(
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String paymentStatus,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false, defaultValue = "placedAt:desc") String sort,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "orders.read");
        return apiResponseFactory.list(
                adminOrderService.listOrders(page, size, status, paymentStatus, q, from, to, sort),
                request
        );
    }

    @GetMapping("/{orderId}")
    public ApiDataResponse<AdminOrderDetailResponse> getOrderDetail(
            @PathVariable UUID orderId,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "orders.read");
        return apiResponseFactory.data(adminOrderService.getOrderDetail(orderId), request);
    }

    @GetMapping("/{orderId}/allowed-transitions")
    public ApiDataResponse<List<String>> listAllowedTransitions(
            @PathVariable UUID orderId,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "orders.read");
        return apiResponseFactory.data(adminOrderService.listAllowedTransitions(orderId), request);
    }

    @PatchMapping("/{orderId}/status")
    public ApiDataResponse<AdminOrderDetailResponse> updateOrderStatus(
            @PathVariable UUID orderId,
            @Valid @RequestBody UpdateOrderStatusRequest body,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "orders.write");
        UUID adminId = resolveAdminId();
        return apiResponseFactory.data(
                adminOrderService.updateOrderStatus(orderId, adminId, body,
                        extractClientIp(request), request.getHeader("User-Agent")),
                request
        );
    }

    @PatchMapping("/{orderId}/payment-status")
    public ApiDataResponse<AdminOrderDetailResponse> updatePaymentStatus(
            @PathVariable UUID orderId,
            @Valid @RequestBody UpdatePaymentStatusRequest body,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "orders.write");
        UUID adminId = resolveAdminId();
        return apiResponseFactory.data(
                adminOrderService.updatePaymentStatus(orderId, adminId, body,
                        extractClientIp(request), request.getHeader("User-Agent")),
                request
        );
    }

    @PostMapping("/{orderId}/refund")
    public ApiDataResponse<AdminOrderDetailResponse> createRefund(
            @PathVariable UUID orderId,
            @Valid @RequestBody CreateRefundRequest body,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "orders.write");
        UUID adminId = resolveAdminId();
        return apiResponseFactory.data(
                adminOrderService.createRefund(orderId, adminId, body,
                        extractClientIp(request), request.getHeader("User-Agent")),
                request
        );
    }

    @PostMapping("/{orderId}/notes")
    public ApiDataResponse<AdminOrderNoteResponse> addNote(
            @PathVariable UUID orderId,
            @Valid @RequestBody CreateOrderNoteRequest body,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "orders.write");
        UUID adminId = resolveAdminId();
        return apiResponseFactory.data(
                adminOrderService.addNote(orderId, adminId, body,
                        extractClientIp(request), request.getHeader("User-Agent")),
                request
        );
    }

    @GetMapping("/{orderId}/notes")
    public ApiDataResponse<List<AdminOrderNoteResponse>> listNotes(
            @PathVariable UUID orderId,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "orders.read");
        return apiResponseFactory.data(adminOrderService.listNotes(orderId), request);
    }

    private UUID resolveAdminId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof AdminPrincipal principal) {
            try {
                return UUID.fromString(principal.id());
            } catch (IllegalArgumentException ignored) {
                // id is not a UUID (e.g. "dev-admin-user") — fall through to dev default
            }
        }
        return DEV_ADMIN_ID;
    }

    private String extractClientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
