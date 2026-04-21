package com.bigbike.bigbike_backend.migration.wordpress.mapper;

import com.bigbike.bigbike_backend.migration.wordpress.model.WpOrderItem;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpPost;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpPostMeta;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

@Component
public class WordPressOrderMapper {

    public record MappedOrder(
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
            List<MappedOrderItem> lineItems,
            List<String> warnings
    ) {}

    public record MappedOrderItem(
            long orderItemId,
            String name,
            String type,
            BigDecimal lineTotal
    ) {}

    public MappedOrder map(WpPost post, List<WpPostMeta> metas, List<WpOrderItem> items) {
        List<String> warnings = new ArrayList<>();
        Map<String, String> metaMap = metas.stream()
                .filter(m -> m.postId() == post.id())
                .collect(Collectors.toMap(WpPostMeta::metaKey, WpPostMeta::metaValue, (a, b) -> a));

        String orderNumber = metaMap.getOrDefault("_order_number", String.valueOf(post.id()));
        String status = mapWcStatus(post.postStatus());
        BigDecimal total = parseBigDecimal(metaMap.get("_order_total"), warnings);
        String currency = metaMap.getOrDefault("_order_currency", "VND");
        String paymentMethod = metaMap.get("_payment_method");

        Long customerUserId = null;
        String custUser = metaMap.get("_customer_user");
        if (custUser != null && !custUser.equals("0")) {
            try { customerUserId = Long.parseLong(custUser); } catch (NumberFormatException ignored) {}
        }

        List<MappedOrderItem> lineItems = items.stream()
                .filter(i -> "line_item".equals(i.orderItemType()))
                .map(i -> new MappedOrderItem(i.orderItemId(), i.orderItemName(), i.orderItemType(), null))
                .toList();

        return new MappedOrder(
                post.id(), orderNumber, status, total, currency, paymentMethod,
                customerUserId,
                metaMap.get("_billing_email"),
                metaMap.get("_billing_first_name"),
                metaMap.get("_billing_last_name"),
                metaMap.get("_billing_phone"),
                metaMap.get("_billing_address_1"),
                metaMap.get("_billing_city"),
                metaMap.getOrDefault("_billing_country", "VN"),
                lineItems, warnings
        );
    }

    private String mapWcStatus(String postStatus) {
        return switch (postStatus) {
            case "wc-pending"    -> "PENDING_PAYMENT";
            case "wc-processing" -> "PROCESSING";
            case "wc-on-hold"    -> "ON_HOLD";
            case "wc-completed"  -> "COMPLETED";
            case "wc-cancelled"  -> "CANCELLED";
            case "wc-refunded"   -> "REFUNDED";
            case "wc-failed"     -> "FAILED";
            default -> "UNKNOWN";
        };
    }

    private BigDecimal parseBigDecimal(String value, List<String> warnings) {
        if (value == null || value.isBlank()) return BigDecimal.ZERO;
        try {
            return new BigDecimal(value.trim());
        } catch (NumberFormatException e) {
            warnings.add("Cannot parse _order_total: " + value);
            return BigDecimal.ZERO;
        }
    }
}
