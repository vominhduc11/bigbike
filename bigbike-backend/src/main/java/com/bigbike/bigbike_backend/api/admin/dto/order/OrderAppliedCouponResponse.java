package com.bigbike.bigbike_backend.api.admin.dto.order;

import java.math.BigDecimal;
import java.util.UUID;

public record OrderAppliedCouponResponse(
        UUID id,
        UUID couponId,
        String code,
        BigDecimal discountAmount
) {}
