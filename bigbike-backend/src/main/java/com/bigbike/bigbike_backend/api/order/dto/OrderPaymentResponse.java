package com.bigbike.bigbike_backend.api.order.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record OrderPaymentResponse(
        UUID id,
        String paymentMethod,
        String status,
        BigDecimal amount,
        String currency,
        Instant paidAt
) {}
