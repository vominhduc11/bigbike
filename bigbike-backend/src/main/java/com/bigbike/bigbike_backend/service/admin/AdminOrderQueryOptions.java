package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.error.ValidationException;
import java.util.Locale;

/** Validated, shared query options for the admin order list and CSV export. */
public record AdminOrderQueryOptions(OrderScope orderScope, boolean overdueOnly) {

    public enum OrderScope {
        ALL,
        OPERATIONAL,
        HISTORICAL
    }

    public static AdminOrderQueryOptions from(String orderScope, String attention) {
        String normalizedScope = orderScope == null || orderScope.isBlank()
                ? OrderScope.ALL.name()
                : orderScope.trim().toUpperCase(Locale.ROOT);
        OrderScope parsedScope;
        try {
            parsedScope = OrderScope.valueOf(normalizedScope);
        } catch (IllegalArgumentException exception) {
            throw ValidationException.fromField(
                    "orderScope",
                    "INVALID_ORDER_SCOPE",
                    "Unknown order scope: " + orderScope
            );
        }

        if (attention == null || attention.isBlank()) {
            return new AdminOrderQueryOptions(parsedScope, false);
        }
        if (!"OVERDUE".equals(attention.trim().toUpperCase(Locale.ROOT))) {
            throw ValidationException.fromField(
                    "attention",
                    "INVALID_ORDER_ATTENTION",
                    "Unknown order attention filter: " + attention
            );
        }
        return new AdminOrderQueryOptions(parsedScope, true);
    }

    public String attentionValue() {
        return overdueOnly ? "OVERDUE" : null;
    }
}
