package com.bigbike.bigbike_backend.api.admin.dto.receivable;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import java.math.BigDecimal;

public record UpdateCustomerCreditRequest(
        Boolean creditEnabled,

        @DecimalMin(value = "0", message = "creditLimit không được âm")
        BigDecimal creditLimit,

        @Min(value = 1, message = "paymentTermsDays phải ít nhất 1 ngày")
        Integer paymentTermsDays,

        /** ACTIVE | SUSPENDED | BLOCKED */
        String creditStatus,

        String creditNote
) {}
