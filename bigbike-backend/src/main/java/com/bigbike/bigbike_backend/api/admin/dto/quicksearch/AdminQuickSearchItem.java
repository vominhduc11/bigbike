package com.bigbike.bigbike_backend.api.admin.dto.quicksearch;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.math.BigDecimal;
import java.util.List;

/** One compact, group-neutral result row. Unused fields are omitted from JSON. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record AdminQuickSearchItem(
        String id,
        String orderNumber,
        String status,
        String customerName,
        String shippingRecipientName,
        String customerEmail,
        String customerPhone,
        BigDecimal totalAmount,
        String currency,
        String displayName,
        String email,
        String phone,
        String name,
        String title,
        String slug,
        String sku,
        String role,
        String matchedField,
        List<AdminQuickSearchVariant> matchedVariants
) {
    public AdminQuickSearchItem {
        matchedVariants = matchedVariants == null ? List.of() : List.copyOf(matchedVariants);
    }

    public static AdminQuickSearchItem order(
            String id,
            String orderNumber,
            String status,
            String customerName,
            String shippingRecipientName,
            String customerEmail,
            String customerPhone,
            BigDecimal totalAmount,
            String currency,
            String matchedField
    ) {
        return new AdminQuickSearchItem(
                id, orderNumber, status, customerName, shippingRecipientName,
                customerEmail, customerPhone, totalAmount, currency,
                null, null, null, null, null, null, null, null,
                matchedField, List.of()
        );
    }

    public static AdminQuickSearchItem product(
            String id,
            String name,
            String sku,
            String matchedField,
            List<AdminQuickSearchVariant> matchedVariants
    ) {
        return new AdminQuickSearchItem(
                id, null, null, null, null, null, null, null, null,
                null, null, null, name, null, null, sku, null,
                matchedField, matchedVariants
        );
    }

    public static AdminQuickSearchItem customer(
            String id,
            String displayName,
            String email,
            String phone,
            String status,
            String matchedField
    ) {
        return new AdminQuickSearchItem(
                id, null, status, null, null, null, null, null, null,
                displayName, email, phone, null, null, null, null, null,
                matchedField, List.of()
        );
    }

    public static AdminQuickSearchItem named(
            String id,
            String name,
            String slug,
            String matchedField
    ) {
        return new AdminQuickSearchItem(
                id, null, null, null, null, null, null, null, null,
                null, null, null, name, null, slug, null, null,
                matchedField, List.of()
        );
    }

    public static AdminQuickSearchItem article(
            String id,
            String title,
            String slug,
            String matchedField
    ) {
        return new AdminQuickSearchItem(
                id, null, null, null, null, null, null, null, null,
                null, null, null, null, title, slug, null, null,
                matchedField, List.of()
        );
    }

    public static AdminQuickSearchItem adminUser(
            String id,
            String displayName,
            String email,
            String role,
            String status,
            String matchedField
    ) {
        return new AdminQuickSearchItem(
                id, null, status, null, null, null, null, null, null,
                displayName, email, null, null, null, null, null, role,
                matchedField, List.of()
        );
    }
}
