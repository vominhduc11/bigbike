package com.bigbike.bigbike_backend.api.admin.dto.order;

import jakarta.validation.constraints.NotBlank;

public record UpdateFulfillmentRequest(
        @NotBlank String fulfillmentStatus,
        String trackingNumber,
        String shippingCarrier,
        String note,
        Boolean customerVisible
) {}
