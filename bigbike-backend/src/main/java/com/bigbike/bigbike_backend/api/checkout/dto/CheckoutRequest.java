package com.bigbike.bigbike_backend.api.checkout.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CheckoutRequest(
        @NotNull @Valid CheckoutAddressRequest billingAddress,
        @Valid
        CheckoutShippingAddressRequest shippingAddress,
        // Optional for backward-compatible callers: omitted values default to COD. Historical
        // payment methods are read-only and cannot be submitted for a new order.
        @Size(max = 32) String paymentMethod,
        @Size(max = 1000)
        String customerNote,
        @Pattern(regexp = "vi|en", message = "Ngôn ngữ đơn hàng chỉ nhận vi hoặc en.")
        String locale,
        // Pseudonymous id returned by gtag('get', ..., 'client_id'). Checkout drops malformed
        // values instead of allowing analytics to block a valid order.
        String analyticsClientId
) {
    /** Source-compatible constructor for existing callers; historical/default locale is Vietnamese. */
    public CheckoutRequest(
            CheckoutAddressRequest billingAddress,
            CheckoutShippingAddressRequest shippingAddress,
            String paymentMethod,
            String customerNote
    ) {
        this(billingAddress, shippingAddress, paymentMethod, customerNote, "vi", null);
    }

    /** Source-compatible constructor for callers that already supply the passive locale. */
    public CheckoutRequest(
            CheckoutAddressRequest billingAddress,
            CheckoutShippingAddressRequest shippingAddress,
            String paymentMethod,
            String customerNote,
            String locale
    ) {
        this(billingAddress, shippingAddress, paymentMethod, customerNote, locale, null);
    }
}
