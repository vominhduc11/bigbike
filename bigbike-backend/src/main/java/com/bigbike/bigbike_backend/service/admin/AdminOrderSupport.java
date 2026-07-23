package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.order.AdminOrderListItemResponse;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderEntity;
import com.bigbike.bigbike_backend.service.ws.OrderWsEvent;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.UUID;
import org.springframework.data.domain.Sort;

/**
 * Stateless helper functions extracted verbatim from {@link AdminOrderService}.
 * Pure mapping / formatting / snapshot builders that reference no instance state,
 * no repositories, and no Spring beans. Imported via {@code import static} so the
 * service's call sites stay unchanged. Follows the {@code ProductFieldApplier}
 * precedent: package-private final class, private constructor, public static methods,
 * no Spring annotation.
 */
final class AdminOrderSupport {

    private AdminOrderSupport() {}

    /**
     * Mirrors {@link #toDetail}'s customer-name fallback for the list: when an
     * order has no customer_name of its own, use the shipping-address name so
     * the list shows the same name the detail screen does.
     */
    static AdminOrderListItemResponse withResolvedCustomerName(
            AdminOrderListItemResponse dto, Map<UUID, String> fallbackNameMap) {
        if (dto.customerName() != null && !dto.customerName().isBlank()) {
            return dto;
        }
        String fallback = fallbackNameMap.get(dto.id());
        if (fallback == null || fallback.isBlank()) {
            return dto;
        }
        return new AdminOrderListItemResponse(
                dto.id(), dto.orderNumber(), dto.status(), dto.fulfillmentType(),
                dto.customerEmail(), dto.customerPhone(), fallback,
                dto.totalAmount(), dto.currency(), dto.placedAt(), dto.itemCount(), dto.source());
    }

    static String safeCustomerName(OrderEntity order) {
        if (order.getCustomerName() != null && !order.getCustomerName().isBlank()) {
            return order.getCustomerName();
        }
        return "Khách hàng";
    }

    static Instant parseFromDate(String date) {
        if (date == null || date.isBlank()) return null;
        try {
            return LocalDate.parse(date).atStartOfDay(ZoneOffset.UTC).toInstant();
        } catch (Exception e) { return null; }
    }

    static Instant parseToDate(String date) {
        if (date == null || date.isBlank()) return null;
        try {
            return LocalDate.parse(date).plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();
        } catch (Exception e) { return null; }
    }

    static Sort resolveSort(String sort) {
        if (sort == null || sort.isBlank()) {
            return Sort.by(Sort.Order.desc("placedAt").nullsLast(), Sort.Order.desc("createdAt"));
        }
        String[] parts = sort.split(":", 2);
        String field = parts[0].trim();
        boolean desc = parts.length < 2 || !"asc".equalsIgnoreCase(parts[1].trim());
        Sort.Order order = switch (field) {
            case "total", "totalAmount" -> desc
                    ? Sort.Order.desc("totalAmount")
                    : Sort.Order.asc("totalAmount");
            case "createdAt", "placedAt" -> desc
                    ? Sort.Order.desc("placedAt").nullsLast()
                    : Sort.Order.asc("placedAt").nullsLast();
            default -> Sort.Order.desc("placedAt").nullsLast();
        };
        return Sort.by(order, Sort.Order.desc("createdAt"));
    }

    static OrderWsEvent buildStatusChangedEvent(OrderEntity order, String newStatus) {
        return new OrderWsEvent(
                "ORDER_STATUS_CHANGED",
                order.getId(),
                order.getOrderNumber(),
                safeCustomerName(order),
                order.getTotalAmount(),
                newStatus,
                order.getPaymentMethod(),
                Instant.now()
        );
    }
}
