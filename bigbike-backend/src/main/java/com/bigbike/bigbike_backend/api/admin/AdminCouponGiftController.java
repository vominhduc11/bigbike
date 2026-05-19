package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.service.admin.AdminCouponGiftService;
import com.bigbike.bigbike_backend.service.admin.AdminCouponGiftService.BulkCouponGiftResult;
import com.bigbike.bigbike_backend.service.admin.AdminCouponGiftService.SendCouponGiftRequest;
import com.bigbike.bigbike_backend.service.auth.DevAdminAuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/coupon-gifts")
@RequiredArgsConstructor
public class AdminCouponGiftController extends AdminControllerSupport {

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

}
