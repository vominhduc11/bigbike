package com.bigbike.bigbike_backend.api.order.dto;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * Pre-check response for a customer about to open a return request on an order.
 *
 * <p>Frontends call this before rendering the "Yêu cầu đổi/trả" form so the UI
 * can show only the items that can still be returned, plus the reason if the
 * whole order is ineligible (window expired, status not COMPLETED, active
 * return already in progress).
 */
public record ReturnEligibilityResponse(
        UUID orderId,
        String orderStatus,
        boolean eligible,
        /** Stable code describing why eligible/ineligible. See {@code Reason} constants. */
        String reason,
        /** Days remaining within the return window; null when no window applies. */
        Long daysRemaining,
        List<EligibleItem> items
) {
    public record EligibleItem(
            UUID orderLineItemId,
            String productName,
            String variantName,
            String sku,
            int orderedQuantity,
            int alreadyReturnedQuantity,
            int returnableQuantity,
            BigDecimal unitPrice
    ) {}

    public static final class Reason {
        public static final String OK                  = "OK";
        public static final String ORDER_NOT_FOUND     = "ORDER_NOT_FOUND";
        public static final String NOT_OWNER           = "NOT_OWNER";
        public static final String ORDER_NOT_COMPLETED = "ORDER_NOT_COMPLETED";
        public static final String WINDOW_EXPIRED      = "WINDOW_EXPIRED";
        public static final String RETURN_IN_PROGRESS  = "RETURN_IN_PROGRESS";
        public static final String NOTHING_TO_RETURN   = "NOTHING_TO_RETURN";

        private Reason() {}
    }
}
