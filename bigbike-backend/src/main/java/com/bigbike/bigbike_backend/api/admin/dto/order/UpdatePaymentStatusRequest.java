package com.bigbike.bigbike_backend.api.admin.dto.order;

import jakarta.validation.constraints.NotBlank;
import java.math.BigDecimal;

public record UpdatePaymentStatusRequest(
        @NotBlank String paymentStatus,
        BigDecimal paidAmount,
        String note,
        Boolean customerVisible
) {}
