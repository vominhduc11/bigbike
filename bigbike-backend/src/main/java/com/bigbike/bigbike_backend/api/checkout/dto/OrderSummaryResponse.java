package com.bigbike.bigbike_backend.api.checkout.dto;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record OrderSummaryResponse(
        UUID id,
        String orderNumber,
        String orderKey,
        String status,
        String paymentStatus,
        String paymentMethod,
        BigDecimal subtotalAmount,
        BigDecimal shippingAmount,
        BigDecimal discountAmount,
        BigDecimal totalAmount,
        String currency,
        /** Non-empty when one or more item prices decreased during checkout (price increases cause a 409 rejection). */
        List<PriceChange> priceChanges
) {
    public record PriceChange(String productName, BigDecimal oldPrice, BigDecimal newPrice) {}
}
