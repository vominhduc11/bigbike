package com.bigbike.bigbike_backend.api.checkout.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CheckoutRequest(
        @NotNull @Valid CheckoutAddressRequest billingAddress,
        @Valid
        CheckoutShippingAddressRequest shippingAddress,
        // Optional for backward-compatible callers: omitted values default to COD. New storefront
        // checkout sends the customer's COD or BANK_TRANSFER selection; reconciliation stays manual.
        @Size(max = 32) String paymentMethod,
        @Size(max = 1000)
        String customerNote,
        @Pattern(regexp = "vi|en", message = "Ngôn ngữ đơn hàng chỉ nhận vi hoặc en.")
        String locale
) {
    /** Source-compatible constructor for existing callers; historical/default locale is Vietnamese. */
    public CheckoutRequest(
            CheckoutAddressRequest billingAddress,
            CheckoutShippingAddressRequest shippingAddress,
            String paymentMethod,
            String customerNote
    ) {
        this(billingAddress, shippingAddress, paymentMethod, customerNote, "vi");
    }
}
