package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.customer.AdminCustomerAddressResponse;
import com.bigbike.bigbike_backend.api.admin.dto.customer.AdminCustomerDetailResponse;
import com.bigbike.bigbike_backend.api.admin.dto.customer.AdminCustomerListItemResponse;
import com.bigbike.bigbike_backend.api.admin.dto.customer.AdminCustomerOrderSummaryResponse;
import com.bigbike.bigbike_backend.api.admin.dto.customer.AdminCustomerOrderSummaryResponse.LatestOrder;
import com.bigbike.bigbike_backend.api.admin.dto.customer.UpdateCustomerRequest;
import com.bigbike.bigbike_backend.api.admin.dto.customer.UpdateCustomerStatusRequest;
import com.bigbike.bigbike_backend.api.error.ConflictException;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.domain.customer.CustomerStatus;
import com.bigbike.bigbike_backend.mapper.CustomerAddressMapper;
import com.bigbike.bigbike_backend.mapper.CustomerMapper;
import com.bigbike.bigbike_backend.persistence.entity.audit.AuditLogEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderEntity;
import com.bigbike.bigbike_backend.persistence.entity.customer.CustomerEntity;
import com.bigbike.bigbike_backend.persistence.repository.audit.AuditLogJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.customer.CustomerAddressJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.customer.CustomerJpaRepository;
import com.bigbike.bigbike_backend.service.common.PageResult;
import com.bigbike.bigbike_backend.service.customer.CustomerSessionService;
import jakarta.persistence.criteria.Predicate;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AdminCustomerService {

    private static final int DEFAULT_SIZE = 20;
    private static final int MAX_SIZE = 100;
    // Derived from CustomerStatus enum — single source of truth for valid DB status values.
    static final Set<String> ALLOWED_STATUSES =
            Arrays.stream(CustomerStatus.values()).map(Enum::name).collect(Collectors.toUnmodifiableSet());

    private final CustomerJpaRepository customerRepo;
    private final CustomerAddressJpaRepository addressRepo;
    private final OrderJpaRepository orderRepo;
    private final AuditLogJpaRepository auditLogRepo;
    private final CustomerSessionService customerSessionService;
    private final CustomerMapper customerMapper;
    private final CustomerAddressMapper customerAddressMapper;

    // ── List ──────────────────────────────────────────────────────────────────

    public PageResult<AdminCustomerListItemResponse> listCustomers(
            int page, int size, String q, String status, Boolean synthetic
    ) {
        int normalizedPage = Math.max(1, page);
        int normalizedSize = (size <= 0) ? DEFAULT_SIZE : Math.min(size, MAX_SIZE);

        Specification<CustomerEntity> spec = buildSpec(q, status, synthetic);
        org.springframework.data.domain.Pageable pageable = PageRequest.of(
                normalizedPage - 1, normalizedSize, Sort.by(Sort.Direction.DESC, "createdAt"));

        Page<CustomerEntity> customerPage = customerRepo.findAll(spec, pageable);

        // Batch-load order aggregates for customers on this page only (eliminates N+1).
        List<UUID> ids = customerPage.getContent().stream().map(CustomerEntity::getId).toList();
        Map<UUID, long[]> orderAggs = fetchOrderAggregates(ids);

        List<AdminCustomerListItemResponse> items = customerPage.getContent().stream()
                .map(c -> {
                    long[] agg = orderAggs.getOrDefault(c.getId(), new long[]{0L, 0L});
                    return customerMapper.toListItem(c, (int) agg[0], BigDecimal.valueOf(agg[1]));
                })
                .collect(Collectors.toList());

        return new PageResult<>(items, normalizedPage, normalizedSize,
                customerPage.getTotalElements(), customerPage.getTotalPages());
    }

    private Specification<CustomerEntity> buildSpec(String q, String status, Boolean synthetic) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (q != null && !q.isBlank()) {
                String pattern = "%" + q.toLowerCase(Locale.ROOT) + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("email")), pattern),
                        cb.like(cb.lower(root.get("phone")), pattern),
                        cb.like(cb.lower(root.get("displayName")), pattern)
                ));
            }
            if (status != null && !status.isBlank()) {
                predicates.add(cb.equal(root.get("status"), status.toUpperCase(Locale.ROOT)));
            }
            if (synthetic != null) {
                predicates.add(cb.equal(root.get("isSynthetic"), synthetic));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    /** Returns Map<customerId, [orderCount, totalSpentRaw]> for the given customer IDs. */
    private Map<UUID, long[]> fetchOrderAggregates(List<UUID> ids) {
        if (ids.isEmpty()) return Map.of();
        return orderRepo.countAndSumByCustomerIds(ids).stream()
                .collect(Collectors.toMap(
                        row -> (UUID) row[0],
                        row -> new long[]{
                                ((Number) row[1]).longValue(),
                                ((BigDecimal) row[2]).longValue()
                        }
                ));
    }

    // ── Detail ────────────────────────────────────────────────────────────────

    public AdminCustomerDetailResponse getCustomerDetail(UUID customerId) {
        CustomerEntity customer = customerRepo.findById(customerId)
                .orElseThrow(() -> new NotFoundException("Customer not found."));

        List<AdminCustomerAddressResponse> addresses = addressRepo.findByCustomerId(customerId)
                .stream().map(customerAddressMapper::toAdminResponse).toList();

        AdminCustomerOrderSummaryResponse orderSummary = buildOrderSummary(customerId);

        return customerMapper.toDetail(customer, addresses, orderSummary);
    }

    // ── Update customer ───────────────────────────────────────────────────────

    @Transactional
    public AdminCustomerDetailResponse updateCustomer(UUID customerId, UUID adminId, UpdateCustomerRequest req) {
        CustomerEntity customer = customerRepo.findById(customerId)
                .orElseThrow(() -> new NotFoundException("Customer not found."));

        String beforeSnapshot = snapshot(customer);

        // Email uniqueness check
        if (req.email() != null && !req.email().isBlank()) {
            String newEmail = req.email().toLowerCase(Locale.ROOT).trim();
            customerRepo.findByEmail(newEmail).ifPresent(existing -> {
                if (!existing.getId().equals(customerId)) {
                    throw new ConflictException("Email already in use by another customer.");
                }
            });
            customer.setEmail(newEmail);
        }

        // Phone uniqueness check
        if (req.phone() != null && !req.phone().isBlank()) {
            customerRepo.findByPhone(req.phone().trim()).ifPresent(existing -> {
                if (!existing.getId().equals(customerId)) {
                    throw new ConflictException("Phone already in use by another customer.");
                }
            });
            customer.setPhone(req.phone().trim());
        }

        if (req.displayName() != null) customer.setDisplayName(req.displayName());
        if (req.firstName() != null) customer.setFirstName(req.firstName());
        if (req.lastName() != null) customer.setLastName(req.lastName());

        customer.setUpdatedAt(Instant.now());
        try {
            customerRepo.saveAndFlush(customer);
        } catch (org.springframework.dao.DataIntegrityViolationException ex) {
            throw new ConflictException("Email or phone is already in use by another customer.");
        }

        auditLogRepo.save(buildAudit(adminId, "CUSTOMER_UPDATED", customerId, beforeSnapshot, snapshot(customer)));

        return getCustomerDetail(customerId);
    }

    // ── Update customer status ─────────────────────────────────────────────────

    @Transactional
    public AdminCustomerDetailResponse updateCustomerStatus(UUID customerId, UUID adminId, UpdateCustomerStatusRequest req) {
        String newStatus = req.status().toUpperCase(Locale.ROOT);
        if (!ALLOWED_STATUSES.contains(newStatus)) {
            throw ValidationException.fromField("status", "INVALID", "Unknown customer status: " + newStatus);
        }

        CustomerEntity customer = customerRepo.findById(customerId)
                .orElseThrow(() -> new NotFoundException("Customer not found."));

        String before = "{\"status\":\"" + customer.getStatus() + "\"}";
        customer.setStatus(newStatus);
        customer.setUpdatedAt(Instant.now());
        customerRepo.save(customer);

        // Revoke all active sessions when account becomes non-ACTIVE so existing
        // session cookies stop working immediately (defence-in-depth alongside the
        // status check in CustomerSessionFilter).
        if (!"ACTIVE".equals(newStatus)) {
            customerSessionService.revokeAllSessions(customerId);
        }

        String after = "{\"status\":\"" + newStatus + "\",\"reason\":" +
                (req.reason() != null ? "\"" + escapeJson(req.reason()) + "\"" : "null") + "}";
        auditLogRepo.save(buildAudit(adminId, "CUSTOMER_STATUS_UPDATED", customerId, before, after));

        return getCustomerDetail(customerId);
    }

    // ── Mapping ───────────────────────────────────────────────────────────────

    private AdminCustomerOrderSummaryResponse buildOrderSummary(UUID customerId) {
        List<OrderEntity> orders = orderRepo.findByCustomerId(customerId);

        BigDecimal totalSpent = orders.stream()
                .map(OrderEntity::getTotalAmount)
                .filter(a -> a != null)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        int count = orders.size();
        BigDecimal avgOrderValue = count > 0
                ? totalSpent.divide(BigDecimal.valueOf(count), 0, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        String segment = deriveSegment(count, totalSpent);

        Instant firstOrderAt = orders.stream()
                .map(OrderEntity::getPlacedAt)
                .filter(a -> a != null)
                .min(Comparator.naturalOrder())
                .orElse(null);

        Instant lastOrderAt = orders.stream()
                .map(OrderEntity::getPlacedAt)
                .filter(a -> a != null)
                .max(Comparator.naturalOrder())
                .orElse(null);

        List<LatestOrder> latest = orders.stream()
                .sorted(Comparator.comparing(
                        OrderEntity::getPlacedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(5)
                .map(customerMapper::toLatestOrder)
                .toList();

        return customerMapper.toOrderSummary(
                count,
                totalSpent,
                avgOrderValue,
                segment,
                firstOrderAt,
                lastOrderAt,
                latest
        );
    }

    private static String deriveSegment(int orderCount, BigDecimal totalSpent) {
        if (orderCount == 0) return "INACTIVE";
        // Thresholds in VND (no decimal currency)
        if (totalSpent.compareTo(new BigDecimal("10000000")) >= 0) return "VIP";
        if (totalSpent.compareTo(new BigDecimal("3000000")) >= 0)  return "LOYAL";
        if (orderCount >= 2) return "REGULAR";
        return "NEW";
    }

    // ── Build helpers ─────────────────────────────────────────────────────────

    private AuditLogEntity buildAudit(UUID adminId, String action, UUID resourceId,
            String before, String after) {
        AuditLogEntity log = new AuditLogEntity();
        log.setActorType("ADMIN");
        log.setActorId(adminId);
        log.setAction(action);
        log.setResourceType("CUSTOMER");
        log.setResourceId(resourceId);
        log.setBeforeData(before);
        log.setAfterData(after);
        log.setCreatedAt(Instant.now());
        return log;
    }

    private static String snapshot(CustomerEntity c) {
        return "{\"email\":\"" + nvl(c.getEmail()) + "\",\"phone\":\"" + nvl(c.getPhone()) +
               "\",\"displayName\":\"" + nvl(c.getDisplayName()) +
               "\",\"status\":\"" + nvl(c.getStatus()) + "\"}";
    }

    private static String nvl(String s) { return s != null ? s : ""; }

    private static String escapeJson(String s) {
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
