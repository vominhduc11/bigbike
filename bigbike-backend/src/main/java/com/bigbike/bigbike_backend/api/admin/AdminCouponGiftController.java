package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.domain.auth.AdminPrincipal;
import com.bigbike.bigbike_backend.service.admin.AdminCouponGiftService;
import com.bigbike.bigbike_backend.service.admin.AdminCouponGiftService.BulkCouponGiftResult;
import com.bigbike.bigbike_backend.service.admin.AdminCouponGiftService.SendCouponGiftRequest;
import com.bigbike.bigbike_backend.service.auth.DevAdminAuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/coupon-gifts")
@RequiredArgsConstructor
public class AdminCouponGiftController {

    private static final UUID DEV_ADMIN_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

    private final AdminCouponGiftService couponGiftService;
    private final DevAdminAuthService devAdminAuthService;
    private final ApiResponseFactory apiResponseFactory;

    @PostMapping("/bulk")
    @ResponseStatus(HttpStatus.OK)
    public ApiDataResponse<BulkCouponGiftResult> sendBulkCouponGift(
            @Valid @RequestBody SendCouponGiftRequest body,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "coupons.write");
        return apiResponseFactory.data(
                couponGiftService.sendBulkCouponGift(resolveAdminId(), body), request);
    }

    private UUID resolveAdminId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof AdminPrincipal principal) {
            try { return UUID.fromString(principal.id()); } catch (IllegalArgumentException ignored) {}
        }
        return DEV_ADMIN_ID;
    }
}
