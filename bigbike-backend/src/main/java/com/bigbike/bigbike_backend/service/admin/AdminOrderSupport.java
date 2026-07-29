package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.order.AdminOrderListItemResponse;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.domain.commerce.OrderStatus;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderEntity;
import com.bigbike.bigbike_backend.service.ws.OrderWsEvent;
import jakarta.persistence.criteria.Predicate;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;

/**
 * Stateless helper functions extracted verbatim from {@link AdminOrderService}.
 * Pure mapping / formatting / snapshot builders that reference no instance state,
 * no repositories, and no Spring beans. Imported via {@code import static} so the
 * service's call sites stay unchanged. Follows the {@code ProductFieldApplier}
 * precedent: package-private final class, private constructor, public static methods,
 * no Spring annotation.
 */
final class AdminOrderSupport {

    static final ZoneId VN_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final Set<String> ORDER_STATUSES = java.util.Arrays.stream(OrderStatus.values())
            .map(Enum::name)
            .collect(Collectors.toUnmodifiableSet());

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
            return LocalDate.parse(date).atStartOfDay(VN_ZONE).toInstant();
        } catch (Exception e) {
            throw ValidationException.fromField(
                    "from", "INVALID_DATE_FORMAT", "Date must be in YYYY-MM-DD format: " + date
            );
        }
    }

    static Instant parseToDate(String date) {
        if (date == null || date.isBlank()) return null;
        try {
            return LocalDate.parse(date).plusDays(1).atStartOfDay(VN_ZONE).toInstant();
        } catch (Exception e) {
            throw ValidationException.fromField(
                    "to", "INVALID_DATE_FORMAT", "Date must be in YYYY-MM-DD format: " + date
            );
        }
    }

    static Specification<OrderEntity> buildFilterSpecification(
            String status, String q, String from, String to
    ) {
        Instant fromInstant = parseFromDate(from);
        Instant toInstant = parseToDate(to);
        String normalizedStatus = status == null ? null : status.trim().toUpperCase(Locale.ROOT);
        if (normalizedStatus != null && !normalizedStatus.isBlank()
                && !ORDER_STATUSES.contains(normalizedStatus)) {
            throw ValidationException.fromField(
                    "status", "INVALID_ORDER_STATUS", "Unknown order status: " + status
            );
        }
        if (fromInstant != null && toInstant != null && !fromInstant.isBefore(toInstant)) {
            throw ValidationException.fromField(
                    "from", "DATE_RANGE_INVALID", "'from' must not be after 'to'."
            );
        }

        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (normalizedStatus != null && !normalizedStatus.isBlank()) {
                predicates.add(cb.equal(root.get("status"), normalizedStatus));
            }
            if (q != null && !q.isBlank()) {
                String pattern = "%" + q.trim().toLowerCase(Locale.ROOT) + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("orderNumber")), pattern),
                        cb.like(cb.lower(root.get("orderKey")), pattern),
                        cb.like(cb.lower(root.get("customerEmail")), pattern),
                        cb.like(cb.lower(root.get("customerPhone")), pattern)
                ));
            }
            if (fromInstant != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("placedAt"), fromInstant));
            }
            if (toInstant != null) {
                predicates.add(cb.lessThan(root.get("placedAt"), toInstant));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
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
