package com.bigbike.bigbike_backend.api.admin.dto.receivable;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public record RecordReceivablePaymentRequest(
        @NotNull @DecimalMin(value = "0.01", message = "amount phải lớn hơn 0")
        BigDecimal amount,

        @NotBlank(message = "paymentMethod là bắt buộc")
        String paymentMethod,  // CASH | BANK_TRANSFER | CARD_TERMINAL | OTHER

        String referenceNumber,
        String note
) {}
