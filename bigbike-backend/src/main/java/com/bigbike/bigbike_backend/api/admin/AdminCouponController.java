package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.api.admin.dto.coupon.AdminCouponDetailResponse;
import com.bigbike.bigbike_backend.api.admin.dto.coupon.AdminCouponListItemResponse;
import com.bigbike.bigbike_backend.api.admin.dto.coupon.CreateCouponRequest;
import com.bigbike.bigbike_backend.api.admin.dto.coupon.UpdateCouponRequest;
import com.bigbike.bigbike_backend.api.admin.dto.coupon.UpdateCouponStatusRequest;
import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiListResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.domain.auth.AdminPrincipal;
import com.bigbike.bigbike_backend.service.admin.AdminCouponService;
import com.bigbike.bigbike_backend.service.auth.DevAdminAuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
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
@RequestMapping("/api/v1/admin/coupons")
@RequiredArgsConstructor
public class AdminCouponController {

    private static final UUID DEV_ADMIN_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

    private final AdminCouponService adminCouponService;
    private final DevAdminAuthService devAdminAuthService;
    private final ApiResponseFactory apiResponseFactory;

    @GetMapping
    public ApiListResponse<AdminCouponListItemResponse> listCoupons(
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String discountType,
            @RequestParam(required = false) Boolean expired,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "coupons.read");
        return apiResponseFactory.list(
                adminCouponService.listCoupons(page, size, q, code, status, discountType, expired), request);
    }

    @GetMapping("/{couponId}")
    public ApiDataResponse<AdminCouponDetailResponse> getCouponById(
            @PathVariable UUID couponId,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "coupons.read");
        return apiResponseFactory.data(adminCouponService.getCouponById(couponId), request);
    }

    @PostMapping
    public ApiDataResponse<AdminCouponDetailResponse> createCoupon(
            @Valid @RequestBody CreateCouponRequest body,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "coupons.write");
        return apiResponseFactory.data(adminCouponService.createCoupon(resolveAdminId(), body), request);
    }

    @PatchMapping("/{couponId}")
    public ApiDataResponse<AdminCouponDetailResponse> updateCoupon(
            @PathVariable UUID couponId,
            @Valid @RequestBody UpdateCouponRequest body,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "coupons.write");
        return apiResponseFactory.data(
                adminCouponService.updateCoupon(couponId, resolveAdminId(), body), request);
    }

    @PatchMapping("/{couponId}/status")
    public ApiDataResponse<AdminCouponDetailResponse> updateCouponStatus(
            @PathVariable UUID couponId,
            @Valid @RequestBody UpdateCouponStatusRequest body,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "coupons.write");
        return apiResponseFactory.data(
                adminCouponService.updateCouponStatus(couponId, resolveAdminId(), body), request);
    }

    private UUID resolveAdminId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof AdminPrincipal principal) {
            try { return UUID.fromString(principal.id()); } catch (IllegalArgumentException ignored) {}
        }
        return DEV_ADMIN_ID;
    }
}
