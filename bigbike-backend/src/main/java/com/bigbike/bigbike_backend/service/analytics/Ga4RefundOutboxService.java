package com.bigbike.bigbike_backend.service.analytics;

import com.bigbike.bigbike_backend.persistence.entity.analytics.Ga4EventOutboxEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderLineItemEntity;
import com.bigbike.bigbike_backend.persistence.repository.analytics.Ga4EventOutboxJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderLineItemJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.customer.CustomerJpaRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class Ga4RefundOutboxService {

    static final String REFUND_EVENT = "refund";
    static final String FALLBACK_CLIENT_ID = "9223372036854775807.9223372036854775807";
    // Owner-confirmed production GA4 start: 2026-09-06 00:00 Asia/Ho_Chi_Minh (UTC+07).
    static final Instant PURCHASE_MEASUREMENT_STARTED_AT = Instant.parse("2026-09-05T17:00:00Z");
    private static final ObjectMapper JSON = new ObjectMapper();

    private final Ga4EventOutboxJpaRepository outboxRepository;
    private final OrderLineItemJpaRepository lineItemRepository;
    private final CustomerJpaRepository customerRepository;

    /** Participates in the caller's cancellation transaction. Serialization failure rolls it back. */
    public void enqueueCancellationRefund(OrderEntity order) {
        // Never subtract a purchase that predates this storefront's production GA4 collection.
        if (order.getPlacedAt() == null
                || order.getPlacedAt().isBefore(PURCHASE_MEASUREMENT_STARTED_AT)) return;
        if (outboxRepository.existsByOrderIdAndEventName(order.getId(), REFUND_EVENT)) return;

        UUID eventId = UUID.randomUUID();
        List<OrderLineItemEntity> lineItems = lineItemRepository.findByOrderId(order.getId());
        Map<String, Object> root = new LinkedHashMap<>();
        root.put("client_id", analyticsClientId(order.getGa4ClientId()));
        if (order.getCustomerId() != null && customerRepository.findById(order.getCustomerId())
                .filter(customer -> !customer.isSynthetic())
                .isPresent()) {
            root.put("user_id", order.getCustomerId().toString());
        }
        root.put("non_personalized_ads", true);

        Map<String, Object> params = new LinkedHashMap<>();
        params.put("transaction_id", order.getOrderNumber());
        params.put("currency", nonBlank(order.getCurrency(), "VND"));
        params.put("value", vnd(order.getTotalAmount()));
        params.put("event_id", eventId.toString());
        params.put("items", lineItems.stream().map(Ga4RefundOutboxService::itemPayload).toList());
        root.put("events", List.of(Map.of("name", REFUND_EVENT, "params", params)));

        Ga4EventOutboxEntity event = new Ga4EventOutboxEntity();
        Instant now = Instant.now();
        event.setId(eventId);
        event.setOrderId(order.getId());
        event.setEventName(REFUND_EVENT);
        event.setPayloadJson(writeJson(root));
        event.setStatus("PENDING");
        event.setAttemptCount(0);
        event.setNextAttemptAt(now);
        event.setCreatedAt(now);
        event.setUpdatedAt(now);
        outboxRepository.save(event);
    }

    private static Map<String, Object> itemPayload(OrderLineItemEntity item) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("item_id", firstNonBlank(
                item.getSku(), item.resolveVariantKey(), item.resolveProductKey(), item.getId().toString()));
        result.put("item_name", nonBlank(item.getProductName(), "Sản phẩm"));
        if (item.getVariantName() != null && !item.getVariantName().isBlank()) {
            result.put("item_variant", item.getVariantName().trim());
        }
        result.put("price", vnd(item.getUnitPrice()));
        result.put("quantity", item.getQuantity());
        return result;
    }

    private static long vnd(BigDecimal value) {
        return (value == null ? BigDecimal.ZERO : value)
                .setScale(0, RoundingMode.HALF_UP)
                .longValue();
    }

    private static String analyticsClientId(String value) {
        if (value == null) return FALLBACK_CLIENT_ID;
        String normalized = value.trim();
        return normalized.length() <= 128 && normalized.matches("[0-9]+\\.[0-9]+")
                ? normalized
                : FALLBACK_CLIENT_ID;
    }

    private static String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) return value.trim();
        }
        throw new IllegalArgumentException("GA4 item identity is required.");
    }

    private static String nonBlank(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }

    private static String writeJson(Map<String, Object> payload) {
        try {
            return JSON.writeValueAsString(payload);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Cannot serialize sanitized GA4 event.", exception);
        }
    }
}
