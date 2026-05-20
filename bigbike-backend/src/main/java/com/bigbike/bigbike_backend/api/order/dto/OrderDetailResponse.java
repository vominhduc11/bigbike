package com.bigbike.bigbike_backend.api.order.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record OrderDetailResponse(
        UUID id,
        String orderNumber,
        String orderKey,
        String status,
        String paymentStatus,
        String fulfillmentStatus,
        String customerEmail,
        String customerPhone,
        String customerNote,
        String currency,
        BigDecimal subtotalAmount,
        BigDecimal discountAmount,
        BigDecimal shippingAmount,
        BigDecimal feeAmount,
        BigDecimal taxAmount,
        BigDecimal totalAmount,
        BigDecimal paidAmount,
        BigDecimal refundAmount,
        String refundReason,
        Instant refundedAt,
        Instant placedAt,
        String channel,
        List<OrderLineItemResponse> lineItems,
        List<OrderAddressResponse> addresses,
        List<OrderShippingItemResponse> shippingItems,
        List<OrderPaymentResponse> payments,
        List<OrderNoteResponse> notes
) {}
