package com.bigbike.bigbike_backend.migration.wordpress.mapper;

import com.bigbike.bigbike_backend.migration.wordpress.model.WpOrderItem;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpOrderItemMeta;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpPost;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpPostMeta;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class WordPressOrderMapper {

    private static final DateTimeFormatter WP_DATETIME =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final WordPressWooCommerceOrderItemMapper itemMapper;

    // ── Backward-compat basic item record (Phase 2A/2B) ─────────────────────
    public record MappedOrderItem(
            long orderItemId,
            String name,
            String type,
            BigDecimal lineTotal
    ) {}

    // ── Payment snapshot derived from order meta ──────────────────────────────
    public record MappedOrderPayment(
            long orderLegacyId,
            String paymentMethod,
            String provider,
            String status,
            BigDecimal amount,
            String currency,
            String transactionId,
            LocalDateTime paidAt
    ) {}

    public record MappedOrder(
            // ── Core fields (Phase 2A compat) ─────────────────────────────────
            long sourceId,
            String orderNumber,
            String status,
            BigDecimal totalAmount,
            String currency,
            String paymentMethod,
            Long customerWpUserId,
            String billingEmail,
            String billingFirstName,
            String billingLastName,
            String billingPhone,
            String billingAddress1,
            String billingCity,
            String billingCountry,
            List<MappedOrderItem> lineItems,    // basic — backward compat
            List<String> warnings,

            // ── Extended fields (Phase 2C) ─────────────────────────────────────
            String orderKey,
            String syntheticCustomerKey,
            String paymentStatus,
            String customerNote,
            String paymentMethodTitle,
            String transactionId,
            BigDecimal subtotalAmount,
            BigDecimal discountAmount,
            BigDecimal shippingAmount,
            BigDecimal feeAmount,
            BigDecimal taxAmount,
            BigDecimal paidAmount,
            LocalDateTime placedAt,
            LocalDateTime paidAt,
            LocalDateTime completedAt,
            LocalDateTime cancelledAt,
            String billingAddress2,
            String billingCompany,
            String billingState,
            String billingPostcode,
            String shippingFirstName,
            String shippingLastName,
            String shippingCompany,
            String shippingAddress1,
            String shippingAddress2,
            String shippingCity,
            String shippingState,
            String shippingPostcode,
            String shippingCountry,
            String ipAddress,
            String userAgent,
            List<WordPressWooCommerceOrderItemMapper.MappedLineItem> lineItemsDetailed,
            List<WordPressWooCommerceOrderItemMapper.MappedShippingItem> shippingItems,
            List<WordPressWooCommerceOrderItemMapper.MappedFeeItem> feeItems,
            List<WordPressWooCommerceOrderItemMapper.MappedCouponItem> couponItems,
            int taxItemsDeferred,
            MappedOrderPayment payment
    ) {}

    /**
     * Full mapping: order post + meta + order items + item meta.
     */
    public MappedOrder map(WpPost post, List<WpPostMeta> metas,
                           List<WpOrderItem> items,
                           Map<Long, List<WpOrderItemMeta>> itemMetas) {
        List<String> warnings = new ArrayList<>();

        Map<String, String> metaMap = metas.stream()
                .filter(m -> m.postId() == post.id())
                .filter(m -> m.metaKey() != null)
                .collect(Collectors.toMap(
                        WpPostMeta::metaKey,
                        m -> m.metaValue() != null ? m.metaValue() : "",
                        (a, b) -> a
                ));

        // ── Core fields ────────────────────────────────────────────────────────
        String orderNumber = metaMap.getOrDefault("_order_number", String.valueOf(post.id()));
        String orderKey = metaMap.get("_order_key");
        if (orderKey == null || orderKey.isBlank()) {
            warnings.add("Missing _order_key for order id=" + post.id());
        }

        String status = mapWcStatus(post.postStatus(), warnings);
        String currency = metaMap.getOrDefault("_order_currency", "VND");

        BigDecimal total = parseBD(metaMap.get("_order_total"), "_order_total", warnings);
        if (total == null || total.compareTo(BigDecimal.ZERO) == 0
                && !metaMap.containsKey("_order_total")) {
            warnings.add("Missing _order_total for order id=" + post.id());
        }

        BigDecimal subtotal  = parseBD(metaMap.get("_cart_subtotal"), "_cart_subtotal", warnings);
        BigDecimal discount  = parseBD(metaMap.get("_cart_discount"), "_cart_discount", warnings);
        BigDecimal shipping  = parseBD(metaMap.get("_order_shipping"), "_order_shipping", warnings);
        BigDecimal tax       = parseBD(metaMap.get("_order_tax"), "_order_tax", warnings);

        String paymentMethod = metaMap.get("_payment_method");
        String paymentMethodTitle = metaMap.get("_payment_method_title");
        String transactionId = metaMap.get("_transaction_id");
        String customerNote = post.postExcerpt();
        String ipAddress = metaMap.get("_customer_ip_address");
        String userAgent = metaMap.get("_customer_user_agent");

        // ── Customer reference ─────────────────────────────────────────────────
        Long customerWpUserId = null;
        String custUserStr = metaMap.get("_customer_user");
        if (custUserStr != null && !custUserStr.isBlank() && !"0".equals(custUserStr.trim())) {
            try { customerWpUserId = Long.parseLong(custUserStr.trim()); }
            catch (NumberFormatException ignored) {}
        }

        // ── Dates ──────────────────────────────────────────────────────────────
        LocalDateTime placedAt    = post.postDate();
        LocalDateTime paidAt      = parseWpDate(metaMap.getOrDefault("_date_paid",
                metaMap.get("_paid_date")));
        LocalDateTime completedAt = parseWpDate(metaMap.getOrDefault("_date_completed",
                metaMap.get("_completed_date")));
        LocalDateTime cancelledAt = null;
        if ("CANCELLED".equals(status)) cancelledAt = post.postDate();

        // ── Payment status ─────────────────────────────────────────────────────
        BigDecimal paidAmount = total != null ? total : BigDecimal.ZERO;
        String paymentStatus = derivePaymentStatus(status, paidAt, transactionId, paidAmount, total, warnings);

        // ── Billing / shipping address snapshots ───────────────────────────────
        String billingEmail   = metaMap.get("_billing_email");
        String billingPhone   = metaMap.get("_billing_phone");

        // ── Order items ────────────────────────────────────────────────────────
        List<MappedOrderItem> basicItems = new ArrayList<>();
        List<WordPressWooCommerceOrderItemMapper.MappedLineItem>     lineItemsDetailed = new ArrayList<>();
        List<WordPressWooCommerceOrderItemMapper.MappedShippingItem> shippingItems     = new ArrayList<>();
        List<WordPressWooCommerceOrderItemMapper.MappedFeeItem>      feeItems          = new ArrayList<>();
        List<WordPressWooCommerceOrderItemMapper.MappedCouponItem>   couponItems       = new ArrayList<>();
        int taxItemsDeferred = 0;

        for (WpOrderItem item : items) {
            List<WpOrderItemMeta> im = itemMetas.getOrDefault(item.orderItemId(), List.of());
            switch (item.orderItemType()) {
                case "line_item" -> {
                    WordPressWooCommerceOrderItemMapper.MappedLineItem li = itemMapper.mapLineItem(item, im);
                    lineItemsDetailed.add(li);
                    warnings.addAll(li.warnings());
                    basicItems.add(new MappedOrderItem(item.orderItemId(), item.orderItemName(),
                            "line_item", li.lineTotal()));
                }
                case "shipping" -> {
                    WordPressWooCommerceOrderItemMapper.MappedShippingItem si = itemMapper.mapShippingItem(item, im);
                    shippingItems.add(si);
                    warnings.addAll(si.warnings());
                }
                case "fee" -> {
                    WordPressWooCommerceOrderItemMapper.MappedFeeItem fi = itemMapper.mapFeeItem(item, im);
                    feeItems.add(fi);
                    warnings.addAll(fi.warnings());
                }
                case "coupon" -> {
                    WordPressWooCommerceOrderItemMapper.MappedCouponItem ci = itemMapper.mapCouponItem(item, im);
                    couponItems.add(ci);
                    warnings.addAll(ci.warnings());
                }
                case "tax" -> taxItemsDeferred++;
                default -> warnings.add("Unknown order_item_type '" + item.orderItemType()
                        + "' for item id=" + item.orderItemId());
            }
        }

        // ── Payment snapshot ───────────────────────────────────────────────────
        MappedOrderPayment payment = new MappedOrderPayment(
                post.id(), paymentMethod,
                resolveProvider(paymentMethod),
                paymentStatus, total, currency, transactionId, paidAt
        );

        // Synthetic customer key for guest orders
        String syntheticKey = null;
        if (customerWpUserId == null) {
            if (billingEmail != null && !billingEmail.isBlank()) {
                syntheticKey = "email:" + billingEmail.toLowerCase().trim();
            } else if (billingPhone != null && !billingPhone.isBlank()) {
                syntheticKey = "phone:" + billingPhone.replaceAll("[^0-9]", "");
            }
        }

        return new MappedOrder(
                post.id(), orderNumber, status, total, currency, paymentMethod,
                customerWpUserId,
                billingEmail,
                metaMap.get("_billing_first_name"),
                metaMap.get("_billing_last_name"),
                billingPhone,
                metaMap.get("_billing_address_1"),
                metaMap.get("_billing_city"),
                metaMap.getOrDefault("_billing_country", "VN"),
                basicItems, warnings,
                // extended
                orderKey, syntheticKey, paymentStatus,
                customerNote, paymentMethodTitle, transactionId,
                subtotal, discount, shipping, null, tax, paidAmount,
                placedAt, paidAt, completedAt, cancelledAt,
                metaMap.get("_billing_address_2"),
                metaMap.get("_billing_company"),
                metaMap.get("_billing_state"),
                metaMap.get("_billing_postcode"),
                metaMap.get("_shipping_first_name"),
                metaMap.get("_shipping_last_name"),
                metaMap.get("_shipping_company"),
                metaMap.get("_shipping_address_1"),
                metaMap.get("_shipping_address_2"),
                metaMap.get("_shipping_city"),
                metaMap.get("_shipping_state"),
                metaMap.get("_shipping_postcode"),
                metaMap.getOrDefault("_shipping_country", "VN"),
                ipAddress, userAgent,
                lineItemsDetailed, shippingItems, feeItems, couponItems,
                taxItemsDeferred, payment
        );
    }

    /** Backward-compatible overload with no item-meta (Phase 2A/2B). */
    public MappedOrder map(WpPost post, List<WpPostMeta> metas, List<WpOrderItem> items) {
        return map(post, metas, items, Map.of());
    }

    // ── Status mapping ────────────────────────────────────────────────────────

    private String mapWcStatus(String postStatus, List<String> warnings) {
        return switch (postStatus) {
            case "wc-pending"    -> "PENDING_PAYMENT";
            case "wc-processing" -> "PROCESSING";
            case "wc-on-hold"    -> "ON_HOLD";
            case "wc-completed"  -> "COMPLETED";
            case "wc-cancelled"  -> "CANCELLED";
            case "wc-refunded"   -> "REFUNDED";
            case "wc-failed"     -> "FAILED";
            default -> {
                warnings.add("Unknown WooCommerce order status: '" + postStatus
                        + "' — defaulting to PENDING_PAYMENT");
                yield "PENDING_PAYMENT";
            }
        };
    }

    private String derivePaymentStatus(String orderStatus, LocalDateTime paidAt,
                                        String transactionId, BigDecimal paidAmount,
                                        BigDecimal total, List<String> warnings) {
        if ("REFUNDED".equals(orderStatus)) return "REFUNDED";
        if ("CANCELLED".equals(orderStatus) || "FAILED".equals(orderStatus)) return orderStatus;
        if (paidAt != null) return "PAID";
        if (transactionId != null && !transactionId.isBlank()) return "PAID";
        if ("COMPLETED".equals(orderStatus)) return "PAID";
        if ("PROCESSING".equals(orderStatus)) {
            warnings.add("Order PROCESSING but no paid date or transaction ID — payment status PENDING");
            return "PENDING";
        }
        return "UNPAID";
    }

    private String resolveProvider(String paymentMethod) {
        if (paymentMethod == null) return "UNKNOWN";
        return switch (paymentMethod.toLowerCase()) {
            case "cod"    -> "COD";
            case "bacs"   -> "BACS";
            case "paypal" -> "PAYPAL";
            case "stripe" -> "STRIPE";
            default -> paymentMethod.toUpperCase();
        };
    }

    // ── Parsers ───────────────────────────────────────────────────────────────

    private BigDecimal parseBD(String v, String field, List<String> warnings) {
        if (v == null || v.isBlank()) return BigDecimal.ZERO;
        try { return new BigDecimal(v.trim()); }
        catch (NumberFormatException e) {
            warnings.add("Cannot parse " + field + ": " + v);
            return BigDecimal.ZERO;
        }
    }

    private LocalDateTime parseWpDate(String v) {
        if (v == null || v.isBlank() || v.startsWith("0000") || "0".equals(v.trim())) return null;
        try { return LocalDateTime.parse(v.trim(), WP_DATETIME); }
        catch (DateTimeParseException e) { return null; }
    }
}
