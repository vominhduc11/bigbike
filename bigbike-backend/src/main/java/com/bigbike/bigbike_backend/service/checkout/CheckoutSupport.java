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
import com.bigbike.bigbike_backend.service.pricing.VariantPricing;
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

    static final String PAYMENT_METHOD_COD = "COD";
    private static final String ANONYMOUS_SCOPE = "anonymous";

    // ── Validation helpers ────────────────────────────────────────────────────

    static void validateAddress(CheckoutAddressRequest addr) {
        validateAddress(addr, "billingAddress");
    }

    static void validateAddress(CheckoutAddressRequest addr, String fieldPrefix) {
        if (addr.fullName() == null || addr.fullName().isBlank()) {
            throw ValidationException.fromField(fieldPrefix + ".fullName", "REQUIRED", "Full name is required.");
        }
        if (addr.phone() == null || !addr.phone().matches("0[3-9]\\d{8}|\\+84[3-9]\\d{8}")) {
            throw ValidationException.fromField(fieldPrefix + ".phone", "INVALID_PHONE",
                    "Số điện thoại không hợp lệ. Vui lòng nhập số VN 10 chữ số (ví dụ: 0901234567).");
        }
        if (addr.email() != null && !addr.email().isBlank()
                && !addr.email().matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")) {
            throw ValidationException.fromField(fieldPrefix + ".email", "INVALID_EMAIL",
                    "Email không hợp lệ.");
        }
        // Two-tier VN address (province/thành phố → phường/xã): both tiers are required so the
        // shop never receives an order it cannot deliver (AUD-007).
        if (addr.province() == null || addr.province().isBlank()) {
            throw ValidationException.fromField(fieldPrefix + ".province", "REQUIRED",
                    "Vui lòng chọn tỉnh/thành phố.");
        }
        if (addr.ward() == null || addr.ward().isBlank()) {
            throw ValidationException.fromField(fieldPrefix + ".ward", "REQUIRED",
                    "Vui lòng chọn phường/xã.");
        }
        if (addr.addressLine1() == null || addr.addressLine1().isBlank()) {
            throw ValidationException.fromField(fieldPrefix + ".addressLine1", "REQUIRED",
                    "Address line 1 is required.");
        }
    }

    static void validatePaymentMethod(String method) {
        // COD is the only storefront payment method (owner decision 2026-07-15, PAY_RULE_001):
        // BACS is no longer offered for new orders. Omitted values are normalised to COD by
        // normalizePaymentMethod; an explicit different value is rejected.
        if (method == null || method.isBlank()) {
            return;
        }
        if (!PAYMENT_METHOD_COD.equals(method)) {
            throw ValidationException.fromField("paymentMethod", "UNSUPPORTED",
                    "Payment method must be COD.");
        }
    }

    /** Owner decision 2026-07-15: every new online order is stored as COD. */
    static String normalizePaymentMethod(String method) {
        return (method == null || method.isBlank()) ? PAYMENT_METHOD_COD : method;
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
        // Blank strings fall back to billing like nulls do — otherwise "" would bypass the
        // billing fallback and persist an empty delivery address (AUD-007).
        return new CheckoutAddressRequest(
                firstNonBlank(shipping.fullName(), billing.fullName()),
                firstNonBlank(shipping.email(), billing.email()),
                firstNonBlank(shipping.phone(), billing.phone()),
                firstNonBlank(shipping.country(), billing.country()),
                firstNonBlank(shipping.province(), billing.province()),
                firstNonBlank(shipping.district(), billing.district()),
                firstNonBlank(shipping.ward(), billing.ward()),
                firstNonBlank(shipping.addressLine1(), billing.addressLine1()),
                shipping.addressLine2()
        );
    }

    private static String firstNonBlank(String primary, String fallback) {
        return (primary != null && !primary.isBlank()) ? primary : fallback;
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
        item.setImageUrl(cartItem.getProductImageUrl()); // snapshot the bought image (AUD-038)
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
        // Snapshot the bought image (AUD-038): variant image if any, else product image.
        item.setImageUrl((variant != null && variant.getImageUrl() != null && !variant.getImageUrl().isBlank())
                ? variant.getImageUrl() : product.getImageUrl());
        item.setQuantity(qty);
        item.setUnitPrice(unitPrice);
        item.setRegularPrice(VariantPricing.regularPrice(product, variant));
        item.setSalePrice(VariantPricing.salePrice(product, variant));
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

    static BigDecimal resolveUnitPrice(ProductEntity product, ProductVariantEntity variant) {
        return VariantPricing.resolveUnitPrice(product, variant);
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
