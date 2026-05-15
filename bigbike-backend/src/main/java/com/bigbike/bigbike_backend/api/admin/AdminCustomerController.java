package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.api.admin.dto.coupon.AdminCouponDetailResponse;
import com.bigbike.bigbike_backend.api.admin.dto.customer.AdminCustomerDetailResponse;
import com.bigbike.bigbike_backend.api.admin.dto.customer.AdminCustomerListItemResponse;
import com.bigbike.bigbike_backend.api.admin.dto.customer.UpdateCustomerRequest;
import com.bigbike.bigbike_backend.api.admin.dto.customer.UpdateCustomerStatusRequest;
import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiListResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.domain.auth.AdminPrincipal;
import com.bigbike.bigbike_backend.service.admin.AdminCouponGiftService;
import com.bigbike.bigbike_backend.service.admin.AdminCustomerService;
import com.bigbike.bigbike_backend.service.auth.DevAdminAuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.util.UUID;
import org.springframework.http.HttpStatus;
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
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/api/v1/admin/customers")
public class AdminCustomerController {

    private static final UUID DEV_ADMIN_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

    private final AdminCustomerService adminCustomerService;
    private final AdminCouponGiftService couponGiftService;
    private final DevAdminAuthService devAdminAuthService;
    private final ApiResponseFactory apiResponseFactory;

    public AdminCustomerController(
            AdminCustomerService adminCustomerService,
            AdminCouponGiftService couponGiftService,
            DevAdminAuthService devAdminAuthService,
            ApiResponseFactory apiResponseFactory
    ) {
        this.adminCustomerService = adminCustomerService;
        this.couponGiftService = couponGiftService;
        this.devAdminAuthService = devAdminAuthService;
        this.apiResponseFactory = apiResponseFactory;
    }

    @GetMapping
    public ApiListResponse<AdminCustomerListItemResponse> listCustomers(
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Boolean synthetic,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "customers.read");
        return apiResponseFactory.list(
                adminCustomerService.listCustomers(page, size, q, status, synthetic), request);
    }

    @GetMapping("/{customerId}")
    public ApiDataResponse<AdminCustomerDetailResponse> getCustomerDetail(
            @PathVariable UUID customerId,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "customers.read");
        return apiResponseFactory.data(adminCustomerService.getCustomerDetail(customerId), request);
    }

    @PatchMapping("/{customerId}")
    public ApiDataResponse<AdminCustomerDetailResponse> updateCustomer(
            @PathVariable UUID customerId,
            @Valid @RequestBody UpdateCustomerRequest body,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "customers.write");
        return apiResponseFactory.data(
                adminCustomerService.updateCustomer(customerId, resolveAdminId(), body), request);
    }

    @PatchMapping("/{customerId}/status")
    public ApiDataResponse<AdminCustomerDetailResponse> updateCustomerStatus(
            @PathVariable UUID customerId,
            @Valid @RequestBody UpdateCustomerStatusRequest body,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "customers.write");
        return apiResponseFactory.data(
                adminCustomerService.updateCustomerStatus(customerId, resolveAdminId(), body), request);
    }

    @PostMapping("/{customerId}/coupon-gift")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiDataResponse<AdminCouponDetailResponse> sendCouponGift(
            @PathVariable UUID customerId,
            @Valid @RequestBody AdminCouponGiftService.SendCouponGiftRequest body,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "coupons.write");
        return apiResponseFactory.data(
                couponGiftService.sendCouponGift(customerId, resolveAdminId(), body), request);
    }

    private UUID resolveAdminId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof AdminPrincipal principal) {
            try { return UUID.fromString(principal.id()); } catch (IllegalArgumentException ignored) {}
        }
        return DEV_ADMIN_ID;
    }
}
