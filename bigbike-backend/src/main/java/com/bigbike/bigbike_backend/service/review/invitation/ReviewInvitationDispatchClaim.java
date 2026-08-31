package com.bigbike.bigbike_backend.service.review.invitation;

import java.util.List;
import java.util.UUID;

public record ReviewInvitationDispatchClaim(
        UUID deliveryId,
        String recipientEmail,
        String customerName,
        String orderNumber,
        String locale,
        String unsubscribeToken,
        List<ProductClaim> products
) {
    public record ProductClaim(String productId, String name, String slug, String token) {}
}
