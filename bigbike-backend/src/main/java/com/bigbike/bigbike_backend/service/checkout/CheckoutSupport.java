package com.bigbike.bigbike_backend.service.checkout;

import com.bigbike.bigbike_backend.api.checkout.dto.CheckoutAddressRequest;
import com.bigbike.bigbike_backend.api.checkout.dto.CheckoutShippingAddressRequest;
import com.bigbike.bigbike_backend.api.checkout.dto.OrderSummaryResponse;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.cart.CartItemEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderAddressEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderLineItemEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderNoteEntity;
import com.bigbike.bigbike_backend.service.ws.OrderWsEvent;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Stateless helpers extracted verbatim from {@link CheckoutService}. These methods take plain
 * arguments and use no instance state, so they live as {@code static} utilities. Imported via
 * {@code import static} so call sites in the service stay unchanged.
 */
final class CheckoutSupport {

    private CheckoutSupport() {}

    private static final Set<String> ALLOWED_PAYMENT_METHODS = Set.of("COD", "BACS");
    private static final String ANONYMOUS_SCOPE = "anonymous";

    // ── Validation helpers ────────────────────────────────────────────────────

    static void validateAddress(CheckoutAddressRequest addr) {
        if (addr.fullName() == null || addr.fullName().isBlank()) {
            throw ValidationException.fromField("billingAddress.fullName", "REQUIRED", "Full name is required.");
        }
        if (addr.phone() == null || !addr.phone().matches("0[3-9]\\d{8}|\\+84[3-9]\\d{8}")) {
            throw ValidationException.fromField("billingAddress.phone", "INVALID_PHONE",
                    "Số điện thoại không hợp lệ. Vui lòng nhập số VN 10 chữ số (ví dụ: 0901234567).");
        }
        if (addr.email() != null && !addr.email().isBlank()
                && !addr.email().matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")) {
            throw ValidationException.fromField("billingAddress.email", "INVALID_EMAIL",
                    "Email không hợp lệ.");
        }
        if (addr.addressLine1() == null || addr.addressLine1().isBlank()) {
            throw ValidationException.fromField("billingAddress.addressLine1", "REQUIRED",
                    "Address line 1 is required.");
        }
    }

    static void validatePaymentMethod(String method) {
        // Payment method is optional now (owner decision 2026-06-23): online orders no longer make the
        // customer choose, the admin reconciles offline. Only reject an explicit, unrecognised value so
        // backward-compatible callers that still send COD/BACS keep working.
        if (method == null || method.isBlank()) {
            return;
        }
        if (!ALLOWED_PAYMENT_METHODS.contains(method)) {
            throw ValidationException.fromField("paymentMethod", "UNSUPPORTED",
                    "Payment method must be COD or BACS.");
        }
    }

    static String normalizeIdempotencyKey(String rawIdempotencyKey) {
        if (rawIdempotencyKey == null) {
            return null;
        }
        String idempotencyKey = rawIdempotencyKey.trim();
        if (idempotencyKey.isEmpty()) {
            return null;
        }
        if (idempotencyKey.length() > 255) {
            throw ValidationException.fromField(
                    "Idempotency-Key",
                    "INVALID",
                    "Idempotency-Key must be 255 characters or less."
            );
        }
        return idempotencyKey;
    }

    static String buildScopeKey(UUID customerId, String guestSessionId) {
        if (customerId != null) {
            return "customer:" + customerId;
        }
        if (guestSessionId != null && !guestSessionId.isBlank()) {
            return "guest:" + guestSessionId;
        }
        return ANONYMOUS_SCOPE;
    }

    static String hashRequest(Object requestBody) {
        try {
            byte[] payload = String.valueOf(requestBody).getBytes(StandardCharsets.UTF_8);
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(payload));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is not available.", e);
        }
    }

    static CheckoutAddressRequest resolveShippingAddress(
            CheckoutAddressRequest billing,
            CheckoutShippingAddressRequest shipping
    ) {
        if (shipping == null || Boolean.TRUE.equals(shipping.sameAsBilling())) {
            return billing;
        }
        return new CheckoutAddressRequest(
                shipping.fullName() != null ? shipping.fullName() : billing.fullName(),
                shipping.email() != null ? shipping.email() : billing.email(),
                shipping.phone() != null ? shipping.phone() : billing.phone(),
                shipping.country() != null ? shipping.country() : billing.country(),
                shipping.province() != null ? shipping.province() : billing.province(),
                shipping.district() != null ? shipping.district() : billing.district(),
                shipping.ward() != null ? shipping.ward() : billing.ward(),
                shipping.addressLine1() != null ? shipping.addressLine1() : billing.addressLine1(),
                shipping.addressLine2()
        );
    }

    // ── Build helpers ─────────────────────────────────────────────────────────

    static OrderLineItemEntity buildLineItemFromCart(
            OrderEntity order, CartItemEntity cartItem, Instant now
    ) {
        OrderLineItemEntity item = new OrderLineItemEntity();
        item.setOrder(order);
        item.setProductId(cartItem.getProductId());
        item.setProductPk(cartItem.getProductPk());
        item.setProductVariantId(cartItem.getProductVariantId());
        // Snapshot the variant's varchar PK (V176): cart-checkout now decrements/reserves at variant
        // level by product_variant_pk, so restore must resolve the same variant for symmetry. Carried
        // through from cart_items.product_variant_pk (set at add-to-cart).
        item.setProductVariantPk(cartItem.getProductVariantPk());
        item.setSku(cartItem.getSku());
        item.setProductName(cartItem.getProductName());
        item.setVariantName(cartItem.getVariantName());
        item.setQuantity(cartItem.getQuantity());
        item.setUnitPrice(cartItem.getUnitPrice());
        item.setRegularPrice(cartItem.getRegularPrice());
        item.setSalePrice(cartItem.getSalePrice());
        item.setLineSubtotal(cartItem.getLineSubtotal());
        item.setLineDiscount(cartItem.getLineDiscount());
        item.setLineTax(BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP));
        item.setLineTotal(cartItem.getLineTotal());
        item.setCreatedAt(now);
        item.setUpdatedAt(now);
        return item;
    }

    static OrderLineItemEntity buildLineItemFromProduct(
            OrderEntity order,
            ProductEntity product,
            ProductVariantEntity variant,
            BigDecimal unitPrice,
            int qty,
            BigDecimal lineSubtotal,
            BigDecimal lineDiscount,
            BigDecimal lineTotal,
            Instant now
    ) {
        OrderLineItemEntity item = new OrderLineItemEntity();
        item.setOrder(order);
        item.setProductId(tryParseUUID(product.getId()));
        item.setProductPk(product.getId());
        item.setProductVariantId(variant != null ? tryParseUUID(variant.getId()) : null);
        // Snapshot the variant's string PK so cancel/refund/return restore can resolve the exact
        // variant (productVariantId is null for migrated wp-* / admin-created variants). Quick-buy
        // decrements the variant by this same string id, so restore stays symmetric. See V158.
        item.setProductVariantPk(variant != null ? variant.getId() : null);
        item.setSku(variant != null ? variant.getSku() : product.getSku());
        item.setProductName(product.getName());
        item.setVariantName(variant != null ? variant.getName() : null);
        item.setQuantity(qty);
        item.setUnitPrice(unitPrice);
        item.setRegularPrice(product.getRetailPrice());
        item.setSalePrice(product.getSalePrice());
        item.setLineSubtotal(lineSubtotal);
        item.setLineDiscount(lineDiscount);
        item.setLineTax(BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP));
        item.setLineTotal(lineTotal);
        item.setCreatedAt(now);
        item.setUpdatedAt(now);
        return item;
    }

    static OrderAddressEntity buildAddress(
            OrderEntity order, String type, CheckoutAddressRequest addr, Instant now
    ) {
        OrderAddressEntity entity = new OrderAddressEntity();
        entity.setOrder(order);
        entity.setType(type);
        entity.setFullName(addr.fullName());
        entity.setEmail(addr.email());
        entity.setPhone(addr.phone());
        entity.setCountry(addr.country() != null ? addr.country() : "VN");
        entity.setProvince(addr.province());
        entity.setDistrict(addr.district());
        entity.setWard(addr.ward());
        entity.setAddressLine1(addr.addressLine1());
        entity.setAddressLine2(addr.addressLine2());
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        return entity;
    }

    static OrderNoteEntity buildSystemNote(OrderEntity order, String content, Instant now) {
        OrderNoteEntity note = new OrderNoteEntity();
        note.setOrder(order);
        note.setAuthorType("SYSTEM");
        note.setNoteType("SYSTEM");
        note.setContent(content);
        note.setCustomerVisible(false);
        note.setCreatedAt(now);
        return note;
    }

    static OrderSummaryResponse toSummary(OrderEntity order, String paymentMethod,
            List<OrderSummaryResponse.PriceChange> priceChanges) {
        return new OrderSummaryResponse(
                order.getId(),
                order.getOrderNumber(),
                order.getOrderKey(),
                order.getStatus(),
                order.getPaymentStatus(),
                paymentMethod,
                order.getSubtotalAmount(),
                order.getShippingAmount(),
                order.getDiscountAmount(),
                order.getTotalAmount(),
                order.getCurrency(),
                priceChanges
        );
    }

    /**
     * Order unit price always comes from the parent product. Variant-level
     * price columns are intentionally ignored — the storefront and cart
     * display the product price regardless of variant, so checkout must
     * agree to keep the displayed total consistent with what the customer
     * paid.
     */
    static BigDecimal resolveUnitPrice(ProductEntity product, ProductVariantEntity variant) {
        BigDecimal p = product.getSalePrice() != null ? product.getSalePrice() : product.getRetailPrice();
        return p.setScale(2, RoundingMode.HALF_UP);
    }

    static UUID tryParseUUID(String id) {
        if (id == null) return null;
        try { return UUID.fromString(id); } catch (IllegalArgumentException e) { return null; }
    }

    static OrderWsEvent buildNewOrderEvent(OrderEntity order, String paymentMethod) {
        String customerName = order.getCustomerEmail() != null && !order.getCustomerEmail().isBlank()
                ? order.getCustomerEmail()
                : (order.getCustomerPhone() != null ? order.getCustomerPhone() : "Khách hàng");
        return new OrderWsEvent(
                "NEW_ORDER",
                order.getId(),
                order.getOrderNumber(),
                customerName,
                order.getTotalAmount(),
                order.getStatus(),
                paymentMethod,
                java.time.Instant.now()
        );
    }
}
