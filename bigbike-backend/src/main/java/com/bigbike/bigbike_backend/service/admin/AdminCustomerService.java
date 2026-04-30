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
import com.bigbike.bigbike_backend.persistence.entity.audit.AuditLogEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderEntity;
import com.bigbike.bigbike_backend.persistence.entity.customer.CustomerAddressEntity;
import com.bigbike.bigbike_backend.persistence.entity.customer.CustomerEntity;
import com.bigbike.bigbike_backend.persistence.repository.audit.AuditLogJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.customer.CustomerAddressJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.customer.CustomerJpaRepository;
import com.bigbike.bigbike_backend.service.common.PageResult;
import com.bigbike.bigbike_backend.service.common.PaginationService;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Stream;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminCustomerService {

    private static final int DEFAULT_SIZE = 20;
    private static final int MAX_SIZE = 100;
    private static final Set<String> ALLOWED_STATUSES =
            Set.of("ACTIVE", "DISABLED", "PENDING", "BLOCKED");

    private final CustomerJpaRepository customerRepo;
    private final CustomerAddressJpaRepository addressRepo;
    private final OrderJpaRepository orderRepo;
    private final AuditLogJpaRepository auditLogRepo;
    private final PaginationService paginationService;

    public AdminCustomerService(
            CustomerJpaRepository customerRepo,
            CustomerAddressJpaRepository addressRepo,
            OrderJpaRepository orderRepo,
            AuditLogJpaRepository auditLogRepo,
            PaginationService paginationService
    ) {
        this.customerRepo = customerRepo;
        this.addressRepo = addressRepo;
        this.orderRepo = orderRepo;
        this.auditLogRepo = auditLogRepo;
        this.paginationService = paginationService;
    }

    // ── List ──────────────────────────────────────────────────────────────────

    public PageResult<AdminCustomerListItemResponse> listCustomers(
            int page, int size, String q, String status, Boolean synthetic
    ) {
        int normalizedPage = Math.max(1, page);
        int normalizedSize = (size <= 0) ? DEFAULT_SIZE : Math.min(size, MAX_SIZE);

        Stream<CustomerEntity> stream = customerRepo.findAll().stream();

        if (q != null && !q.isBlank()) {
            String qLower = q.toLowerCase(Locale.ROOT);
            stream = stream.filter(c ->
                    matchesQ(c.getEmail(), qLower) ||
                    matchesQ(c.getPhone(), qLower) ||
                    matchesQ(c.getDisplayName(), qLower)
            );
        }
        if (status != null && !status.isBlank()) {
            stream = stream.filter(c -> status.equalsIgnoreCase(c.getStatus()));
        }
        if (synthetic != null) {
            stream = stream.filter(c -> c.isSynthetic() == synthetic);
        }

        List<AdminCustomerListItemResponse> items = stream
                .sorted(Comparator.comparing(CustomerEntity::getCreatedAt, Comparator.reverseOrder()))
                .map(this::toListItem)
                .toList();

        return paginationService.paginate(items, normalizedPage, normalizedSize);
    }

    // ── Detail ────────────────────────────────────────────────────────────────

    public AdminCustomerDetailResponse getCustomerDetail(UUID customerId) {
        CustomerEntity customer = customerRepo.findById(customerId)
                .orElseThrow(() -> new NotFoundException("Customer not found."));

        List<AdminCustomerAddressResponse> addresses = addressRepo.findByCustomerId(customerId)
                .stream().map(this::toAddress).toList();

        AdminCustomerOrderSummaryResponse orderSummary = buildOrderSummary(customerId);

        return toDetail(customer, addresses, orderSummary);
    }

    // ── Update customer ───────────────────────────────────────────────────────

    @Transactional
    public AdminCustomerDetailResponse updateCustomer(UUID customerId, UUID adminId, UpdateCustomerRequest req) {
        CustomerEntity customer = customerRepo.findById(customerId)
                .orElseThrow(() -> new NotFoundException("Customer not found."));

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

        String beforeSnapshot = snapshot(customer);

        if (req.displayName() != null) customer.setDisplayName(req.displayName());
        if (req.firstName() != null) customer.setFirstName(req.firstName());
        if (req.lastName() != null) customer.setLastName(req.lastName());

        customer.setUpdatedAt(Instant.now());
        customerRepo.save(customer);

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

        String after = "{\"status\":\"" + newStatus + "\",\"reason\":" +
                (req.reason() != null ? "\"" + escapeJson(req.reason()) + "\"" : "null") + "}";
        auditLogRepo.save(buildAudit(adminId, "CUSTOMER_STATUS_UPDATED", customerId, before, after));

        return getCustomerDetail(customerId);
    }

    // ── Mapping ───────────────────────────────────────────────────────────────

    private AdminCustomerListItemResponse toListItem(CustomerEntity c) {
        List<OrderEntity> orders = orderRepo.findByCustomerId(c.getId());
        BigDecimal totalSpent = orders.stream()
                .map(OrderEntity::getTotalAmount)
                .filter(a -> a != null)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return new AdminCustomerListItemResponse(
                c.getId(), c.getLegacyId(), c.getEmail(), c.getPhone(),
                c.getDisplayName(), c.getStatus(), c.isSynthetic(),
                c.getLastLoginAt(), c.getCreatedAt(), orders.size(), totalSpent
        );
    }

    private AdminCustomerDetailResponse toDetail(CustomerEntity c,
            List<AdminCustomerAddressResponse> addresses,
            AdminCustomerOrderSummaryResponse orderSummary) {
        return new AdminCustomerDetailResponse(
                c.getId(), c.getLegacyId(), c.getEmail(), c.getPhone(),
                c.getDisplayName(), c.getFirstName(), c.getLastName(),
                c.getStatus(), c.isSynthetic(),
                c.getEmailVerifiedAt(), c.getPhoneVerifiedAt(), c.getLastLoginAt(),
                c.getCreatedAt(), c.getUpdatedAt(),
                addresses, orderSummary
        );
    }

    private AdminCustomerAddressResponse toAddress(CustomerAddressEntity a) {
        return new AdminCustomerAddressResponse(
                a.getId(), a.getType(), a.getFullName(), a.getPhone(),
                a.getCountry(), a.getProvince(), a.getDistrict(), a.getWard(),
                a.getAddressLine1(), a.getAddressLine2(), a.isDefault()
        );
    }

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
                .map(o -> new LatestOrder(o.getId(), o.getOrderNumber(), o.getStatus(),
                        o.getTotalAmount(), o.getPlacedAt()))
                .toList();

        return new AdminCustomerOrderSummaryResponse(
                count, totalSpent, avgOrderValue, segment,
                firstOrderAt, lastOrderAt, latest);
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

    private static boolean matchesQ(String field, String qLower) {
        return field != null && field.toLowerCase(Locale.ROOT).contains(qLower);
    }

    private static String nvl(String s) { return s != null ? s : ""; }

    private static String escapeJson(String s) {
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
