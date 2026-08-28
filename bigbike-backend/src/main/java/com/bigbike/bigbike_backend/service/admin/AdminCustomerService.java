package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.customer.AdminCustomerAddressResponse;
import com.bigbike.bigbike_backend.api.admin.dto.customer.AdminCustomerDetailResponse;
import com.bigbike.bigbike_backend.api.admin.dto.customer.AdminCustomerListItemResponse;
import com.bigbike.bigbike_backend.api.admin.dto.customer.AdminCustomerOrderSummaryResponse;
import com.bigbike.bigbike_backend.api.admin.dto.customer.AdminCustomerOrderSummaryResponse.LatestOrder;
import com.bigbike.bigbike_backend.api.admin.dto.customer.AdminCustomerSummaryResponse;
import com.bigbike.bigbike_backend.api.admin.dto.customer.UpdateCustomerRequest;
import com.bigbike.bigbike_backend.api.admin.dto.customer.UpdateCustomerStatusRequest;
import com.bigbike.bigbike_backend.api.error.ConflictException;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.domain.customer.CustomerStatus;
import com.bigbike.bigbike_backend.mapper.CustomerAddressMapper;
import com.bigbike.bigbike_backend.mapper.CustomerMapper;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderEntity;
import com.bigbike.bigbike_backend.persistence.entity.customer.CustomerEntity;
import com.bigbike.bigbike_backend.service.admin.support.AuditLogFactory;
import com.bigbike.bigbike_backend.service.audit.AuditLogWriter;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.customer.CustomerAddressJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.customer.CustomerJpaRepository;
import com.bigbike.bigbike_backend.service.common.PageResult;
import com.bigbike.bigbike_backend.service.customer.CustomerAvatarStorageService;
import com.bigbike.bigbike_backend.service.customer.CustomerSessionService;
import com.bigbike.bigbike_backend.util.PhoneNumbers;
import com.bigbike.bigbike_backend.util.AdminSearchText;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.json.JsonMapper;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.Expression;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Service
@RequiredArgsConstructor
public class AdminCustomerService {

    private static final int DEFAULT_SIZE = 20;
    private static final int MAX_SIZE = 100;
    private static final ObjectMapper AUDIT_MAPPER = JsonMapper.builder().findAndAddModules().build();
    private static final Pattern PHONE_INPUT_PATTERN = Pattern.compile("^\\+?[0-9() .-]+$");
    /** Lifetime order total (VND) at which a customer is classified VIP — see {@link #deriveSegment}. */
    private static final BigDecimal VIP_MIN_SPENT = new BigDecimal("10000000");
    // Derived from CustomerStatus enum — single source of truth for valid DB status values.
    static final Set<String> ALLOWED_STATUSES =
            Arrays.stream(CustomerStatus.values()).map(Enum::name).collect(Collectors.toUnmodifiableSet());

    private final CustomerJpaRepository customerRepo;
    private final CustomerAddressJpaRepository addressRepo;
    private final OrderJpaRepository orderRepo;
    private final AuditLogWriter auditLogWriter;
    private final AuditLogFactory auditLogFactory;
    private final CustomerSessionService customerSessionService;
    private final CustomerMapper customerMapper;
    private final CustomerAddressMapper customerAddressMapper;
    private final CustomerAvatarStorageService customerAvatarStorageService;

    // ── List ──────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public PageResult<AdminCustomerListItemResponse> listCustomers(
            int page, int size, String q, String status, Boolean synthetic, Boolean emailVerified
    ) {
        int normalizedPage = Math.max(1, page);
        int normalizedSize = (size <= 0) ? DEFAULT_SIZE : Math.min(size, MAX_SIZE);
        String normalizedStatus = normalizeOptionalStatus(status);

        Specification<CustomerEntity> spec = buildSpec(q, normalizedStatus, synthetic, emailVerified);
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

    static Specification<CustomerEntity> buildSpec(
            String q, String status, Boolean synthetic, Boolean emailVerified
    ) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (q != null && !q.isBlank()) {
                List<Predicate> tokenPredicates = new ArrayList<>();
                for (String token : AdminSearchText.tokens(q)) {
                    String pattern = AdminSearchText.likePattern(token);
                    tokenPredicates.add(cb.or(
                            cb.like(unaccentLower(cb, root.get("email")), pattern, '\\'),
                            cb.like(unaccentLower(cb, root.get("phone")), pattern, '\\'),
                            cb.like(unaccentLower(cb, root.get("displayName")), pattern, '\\'),
                            cb.like(unaccentLower(cb, root.get("firstName")), pattern, '\\'),
                            cb.like(unaccentLower(cb, root.get("lastName")), pattern, '\\')
                    ));
                }
                predicates.add(cb.and(tokenPredicates.toArray(new Predicate[0])));
            }
            if (status != null && !status.isBlank()) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            if (synthetic != null) {
                predicates.add(cb.equal(root.get("isSynthetic"), synthetic));
            }
            if (Boolean.TRUE.equals(emailVerified)) {
                predicates.add(cb.isNotNull(root.get("emailVerifiedAt")));
            } else if (Boolean.FALSE.equals(emailVerified)) {
                predicates.add(cb.isNull(root.get("emailVerifiedAt")));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    private static Expression<String> unaccentLower(CriteriaBuilder cb, Expression<?> value) {
        return cb.function("unaccent", String.class, cb.lower(value.as(String.class)));
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

    // ── Summary (Customers screen KPIs) ───────────────────────────────────────

    @Transactional(readOnly = true)
    public AdminCustomerSummaryResponse getCustomerSummary() {
        long total = customerRepo.count();
        long vip = orderRepo.findVipCustomerIds(VIP_MIN_SPENT).size();
        long newLast30Days =
                customerRepo.countNonSyntheticCreatedAfter(Instant.now().minus(30, ChronoUnit.DAYS));
        long active = customerRepo.countNonSyntheticByStatus("ACTIVE");
        return new AdminCustomerSummaryResponse(total, vip, newLast30Days, active);
    }

    // ── Detail ────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
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

        rejectReadOnlyProfileFields(req);

        // Phone uniqueness check — chuẩn hóa SĐT (nhất quán với đăng ký) trước khi đối chiếu/lưu
        if (req.phone() != null) {
            if (req.phone().isBlank()) {
                customer.setPhone(null);
            } else {
                String rawPhone = req.phone().trim();
                String normalizedPhone = PhoneNumbers.normalize(rawPhone);
                if (!PHONE_INPUT_PATTERN.matcher(rawPhone).matches()
                        || normalizedPhone == null
                        || normalizedPhone.length() < 8
                        || normalizedPhone.length() > 15) {
                    throw ValidationException.fromField(
                            "phone", "INVALID_PHONE", "Số điện thoại không hợp lệ.");
                }
                rejectPhoneOwnedByAnotherCustomer(customerId, normalizedPhone);
                customer.setPhone(normalizedPhone);
            }
        }

        if (req.displayName() != null) customer.setDisplayName(req.displayName());

        customer.setUpdatedAt(Instant.now());
        try {
            customerRepo.saveAndFlush(customer);
        } catch (org.springframework.dao.DataIntegrityViolationException ex) {
            throw new ConflictException("Phone is already in use by another customer.");
        }

        auditLogWriter.save(auditLogFactory.build(
                "ADMIN", adminId, "CUSTOMER_UPDATED", "CUSTOMER", customerId, beforeSnapshot, snapshot(customer)));

        return getCustomerDetail(customerId);
    }

    // ── Remove avatar (admin — view + remove only, never upload) ──────────────

    @Transactional
    public AdminCustomerDetailResponse removeAvatar(UUID customerId, UUID adminId) {
        CustomerEntity customer = customerRepo.findById(customerId)
                .orElseThrow(() -> new NotFoundException("Customer not found."));

        String previousUrl = customer.getAvatarUrl();
        if (previousUrl != null) {
            customer.setAvatarUrl(null);
            customer.setUpdatedAt(Instant.now());
            customerRepo.saveAndFlush(customer);
            auditLogWriter.save(auditLogFactory.build(
                    "ADMIN",
                    adminId,
                    "CUSTOMER_AVATAR_REMOVED",
                    "CUSTOMER",
                    customerId,
                    auditJson(Map.of("avatarPresent", true)),
                    auditJson(Map.of("avatarPresent", false))));
            deleteAvatarAfterCommit(previousUrl);
        }

        return getCustomerDetail(customerId);
    }

    void deleteAvatarAfterCommit(String previousUrl) {
        Runnable cleanup = () -> customerAvatarStorageService.deleteAvatar(previousUrl);
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    cleanup.run();
                }
            });
            return;
        }
        cleanup.run();
    }

    // ── Update customer status ─────────────────────────────────────────────────

    @Transactional
    public AdminCustomerDetailResponse updateCustomerStatus(UUID customerId, UUID adminId, UpdateCustomerStatusRequest req) {
        String newStatus = normalizeRequiredStatus(req.status());

        CustomerEntity customer = customerRepo.findById(customerId)
                .orElseThrow(() -> new NotFoundException("Customer not found."));
        if (customer.isSynthetic()) {
            if (!newStatus.equals(customer.getStatus())) {
                throw new ConflictException("Synthetic customer status cannot be changed.");
            }
            return getCustomerDetail(customerId);
        }

        String before = auditJson(Map.of("status", nvl(customer.getStatus())));
        customer.setStatus(newStatus);
        customer.setUpdatedAt(Instant.now());
        customerRepo.save(customer);

        // Revoke all active sessions when account becomes non-ACTIVE so existing
        // session cookies stop working immediately (defence-in-depth alongside the
        // status check in CustomerSessionFilter).
        if (!"ACTIVE".equals(newStatus)) {
            customerSessionService.revokeAllSessions(customerId);
        }

        Map<String, Object> afterValues = new LinkedHashMap<>();
        afterValues.put("status", newStatus);
        afterValues.put("reason", req.reason());
        String after = auditJson(afterValues);
        auditLogWriter.save(auditLogFactory.build(
                "ADMIN", adminId, "CUSTOMER_STATUS_UPDATED", "CUSTOMER", customerId, before, after));

        return getCustomerDetail(customerId);
    }

    // ── Mapping ───────────────────────────────────────────────────────────────

    private AdminCustomerOrderSummaryResponse buildOrderSummary(UUID customerId) {
        List<OrderEntity> orders = orderRepo.findByCustomerId(customerId);
        List<OrderEntity> qualifyingOrders = orders.stream()
                .filter(order -> !"CANCELLED".equals(order.getStatus()))
                .toList();

        BigDecimal totalSpent = qualifyingOrders.stream()
                .map(OrderEntity::getTotalAmount)
                .filter(a -> a != null)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        int count = qualifyingOrders.size();
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
        if (totalSpent.compareTo(VIP_MIN_SPENT) >= 0) return "VIP";
        if (totalSpent.compareTo(new BigDecimal("3000000")) >= 0)  return "LOYAL";
        if (orderCount >= 2) return "REGULAR";
        return "NEW";
    }

    // ── Build helpers ─────────────────────────────────────────────────────────

    private static String snapshot(CustomerEntity c) {
        Map<String, Object> values = new LinkedHashMap<>();
        values.put("email", nvl(c.getEmail()));
        values.put("phone", nvl(c.getPhone()));
        values.put("displayName", nvl(c.getDisplayName()));
        values.put("status", nvl(c.getStatus()));
        return auditJson(values);
    }

    private static String nvl(String s) { return s != null ? s : ""; }

    static String normalizeOptionalStatus(String status) {
        if (status == null || status.isBlank()) {
            return null;
        }
        return normalizeRequiredStatus(status);
    }

    private static String normalizeRequiredStatus(String status) {
        if (status == null || status.isBlank()) {
            throw ValidationException.fromField("status", "INVALID", "Customer status must not be blank.");
        }
        String normalized = status.toUpperCase(Locale.ROOT);
        if (!ALLOWED_STATUSES.contains(normalized)) {
            throw ValidationException.fromField("status", "INVALID", "Unknown customer status: " + normalized);
        }
        return normalized;
    }

    private static void rejectReadOnlyProfileFields(UpdateCustomerRequest req) {
        if (req.email() != null) {
            throw ValidationException.fromField(
                    "email", "READ_ONLY", "Email cannot be changed from the admin customer API.");
        }
        if (req.firstName() != null) {
            throw ValidationException.fromField(
                    "firstName", "READ_ONLY", "First name cannot be changed from the admin customer API.");
        }
        if (req.lastName() != null) {
            throw ValidationException.fromField(
                    "lastName", "READ_ONLY", "Last name cannot be changed from the admin customer API.");
        }
    }

    private void rejectPhoneOwnedByAnotherCustomer(UUID customerId, String normalizedPhone) {
        if (customerRepo.countByNormalizedPhoneExcludingId(normalizedPhone, customerId) > 0) {
            throw new ConflictException("Phone already in use by another customer.");
        }
    }

    private static String auditJson(Map<String, ?> values) {
        try {
            return AUDIT_MAPPER.writeValueAsString(values);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Unable to serialize customer audit snapshot.", ex);
        }
    }
}
