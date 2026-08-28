package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.order.AdminOrderListItemResponse;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.domain.commerce.OrderStatus;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderAddressEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderEntity;
import com.bigbike.bigbike_backend.service.ws.OrderWsEvent;
import com.bigbike.bigbike_backend.util.AdminSearchText;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
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

        return (root, criteriaQuery, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (normalizedStatus != null && !normalizedStatus.isBlank()) {
                predicates.add(cb.equal(root.get("status"), normalizedStatus));
            }
            if (q != null && !q.isBlank()) {
                List<Predicate> tokenPredicates = new ArrayList<>();
                for (String token : AdminSearchText.tokens(q)) {
                    String pattern = AdminSearchText.likePattern(token);
                    tokenPredicates.add(cb.or(
                            cb.like(unaccentLower(cb, root.get("orderNumber")), pattern, '\\'),
                            cb.like(unaccentLower(cb, root.get("orderKey")), pattern, '\\'),
                            cb.like(unaccentLower(cb, root.get("customerEmail")), pattern, '\\'),
                            cb.like(unaccentLower(cb, root.get("customerPhone")), pattern, '\\'),
                            cb.like(unaccentLower(cb, root.get("customerName")), pattern, '\\'),
                            shippingRecipientMatches(root, criteriaQuery, cb, pattern)
                    ));
                }
                predicates.add(cb.and(tokenPredicates.toArray(new Predicate[0])));
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

    private static Expression<String> unaccentLower(
            jakarta.persistence.criteria.CriteriaBuilder cb,
            Expression<?> value
    ) {
        return cb.function("unaccent", String.class, cb.lower(value.as(String.class)));
    }

    private static Predicate shippingRecipientMatches(
            Root<OrderEntity> orderRoot,
            CriteriaQuery<?> criteriaQuery,
            jakarta.persistence.criteria.CriteriaBuilder cb,
            String pattern
    ) {
        Subquery<UUID> addressSubquery = criteriaQuery.subquery(UUID.class);
        Root<OrderAddressEntity> address = addressSubquery.from(OrderAddressEntity.class);
        addressSubquery.select(address.get("id"));
        addressSubquery.where(
                cb.equal(address.get("order").get("id"), orderRoot.get("id")),
                cb.equal(address.get("type"), "SHIPPING"),
                cb.like(unaccentLower(cb, address.get("fullName")), pattern, '\\')
        );
        return cb.exists(addressSubquery);
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
