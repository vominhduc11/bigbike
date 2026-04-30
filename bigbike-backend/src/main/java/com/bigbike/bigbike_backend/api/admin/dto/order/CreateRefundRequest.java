package com.bigbike.bigbike_backend.api.admin.dto.order;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public record CreateRefundRequest(
        @NotNull @DecimalMin(value = "0.01", message = "refundAmount must be greater than 0")
        BigDecimal refundAmount,
        String refundReason,
        String note,
        Boolean customerVisible
) {}
