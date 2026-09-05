package com.bigbike.bigbike_backend.service.checkout;

import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderLineItemEntity;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/** Immutable data captured from the committed checkout inputs for the optional Telegram alert. */
public record TelegramOrderSnapshot(
        UUID orderId,
        String orderNumber,
        String customerName,
        String customerPhone,
        String customerEmail,
        BigDecimal totalAmount,
        String currency,
        String paymentMethod,
        String source,
        List<LineItem> lineItems
) {

    public TelegramOrderSnapshot {
        lineItems = lineItems == null ? List.of() : List.copyOf(lineItems);
    }

    public static TelegramOrderSnapshot from(
            OrderEntity order,
            String paymentMethod,
            List<OrderLineItemEntity> lineItems
    ) {
        List<LineItem> snapshotItems = lineItems == null
                ? List.of()
                : lineItems.stream()
                        .filter(item -> item != null)
                        .map(item -> new LineItem(
                                item.getProductName(),
                                item.getVariantName(),
                                item.getQuantity(),
                                item.getUnitPrice()))
                        .toList();

        return new TelegramOrderSnapshot(
                order.getId(),
                order.getOrderNumber(),
                order.getCustomerName(),
                order.getCustomerPhone(),
                order.getCustomerEmail(),
                order.getTotalAmount(),
                order.getCurrency(),
                paymentMethod,
                order.getSource(),
                snapshotItems);
    }

    public record LineItem(
            String productName,
            String variantName,
            int quantity,
            BigDecimal unitPrice
    ) {}
}
