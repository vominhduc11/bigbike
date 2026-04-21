package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.coupon.AdminCouponDetailResponse;
import com.bigbike.bigbike_backend.api.admin.dto.coupon.AdminCouponListItemResponse;
import com.bigbike.bigbike_backend.api.admin.dto.coupon.CreateCouponRequest;
import com.bigbike.bigbike_backend.api.admin.dto.coupon.UpdateCouponRequest;
import com.bigbike.bigbike_backend.api.admin.dto.coupon.UpdateCouponStatusRequest;
import com.bigbike.bigbike_backend.api.error.ConflictException;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.persistence.entity.audit.AuditLogEntity;
import com.bigbike.bigbike_backend.persistence.entity.coupon.CouponEntity;
import com.bigbike.bigbike_backend.persistence.repository.audit.AuditLogJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.coupon.CouponJpaRepository;
import com.bigbike.bigbike_backend.service.common.PageResult;
import com.bigbike.bigbike_backend.service.common.PaginationService;
import java.math.BigDecimal;
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
public class AdminCouponService {

    private static final int DEFAULT_SIZE = 20;
    private static final int MAX_SIZE = 100;
    private static final Set<String> ALLOWED_DISCOUNT_TYPES = Set.of("FIXED", "PERCENT");
    private static final Set<String> ALLOWED_STATUSES = Set.of("ACTIVE", "INACTIVE", "EXPIRED", "ARCHIVED");

    private final CouponJpaRepository couponRepo;
    private final AuditLogJpaRepository auditLogRepo;
    private final PaginationService paginationService;

    public AdminCouponService(
            CouponJpaRepository couponRepo,
            AuditLogJpaRepository auditLogRepo,
            PaginationService paginationService
    ) {
        this.couponRepo = couponRepo;
        this.auditLogRepo = auditLogRepo;
        this.paginationService = paginationService;
    }

    // ── List ──────────────────────────────────────────────────────────────────

    public PageResult<AdminCouponListItemResponse> listCoupons(
            int page, int size, String q, String code, String status,
            String discountType, Boolean expired
    ) {
        int normalizedPage = Math.max(1, page);
        int normalizedSize = (size <= 0) ? DEFAULT_SIZE : Math.min(size, MAX_SIZE);

        Instant now = Instant.now();
        Stream<CouponEntity> stream = couponRepo.findAll().stream();

        if (q != null && !q.isBlank()) {
            String qLower = q.toLowerCase(Locale.ROOT);
            stream = stream.filter(c ->
                    matchesQ(c.getCode(), qLower) || matchesQ(c.getName(), qLower));
        }
        if (code != null && !code.isBlank()) {
            stream = stream.filter(c -> code.equalsIgnoreCase(c.getCode()));
        }
        if (status != null && !status.isBlank()) {
            stream = stream.filter(c -> status.equalsIgnoreCase(c.getStatus()));
        }
        if (discountType != null && !discountType.isBlank()) {
            stream = stream.filter(c -> discountType.equalsIgnoreCase(c.getDiscountType()));
        }
        if (expired != null) {
            stream = stream.filter(c -> {
                boolean isExpired = c.getExpiresAt() != null && c.getExpiresAt().isBefore(now);
                return isExpired == expired;
            });
        }

        List<AdminCouponListItemResponse> items = stream
                .sorted(Comparator.comparing(CouponEntity::getCreatedAt, Comparator.reverseOrder()))
                .map(this::toListItem)
                .toList();

        return paginationService.paginate(items, normalizedPage, normalizedSize);
    }

    // ── Detail ────────────────────────────────────────────────────────────────

    public AdminCouponDetailResponse getCouponById(UUID couponId) {
        CouponEntity entity = couponRepo.findById(couponId)
                .orElseThrow(() -> new NotFoundException("Coupon not found."));
        return toDetail(entity);
    }

    // ── Create ────────────────────────────────────────────────────────────────

    @Transactional
    public AdminCouponDetailResponse createCoupon(UUID adminId, CreateCouponRequest req) {
        String code = req.code().trim().toUpperCase(Locale.ROOT);
        String type = req.discountType().trim().toUpperCase(Locale.ROOT);

        // Code uniqueness
        couponRepo.findByCode(code).ifPresent(existing -> {
            throw new ConflictException("Coupon code '" + code + "' already exists.");
        });

        // discountType validation
        if (!ALLOWED_DISCOUNT_TYPES.contains(type)) {
            throw ValidationException.fromField("discountType", "INVALID",
                    "discountType must be FIXED or PERCENT.");
        }

        // Amount validation
        if (req.amount() == null || req.amount().compareTo(BigDecimal.ZERO) <= 0) {
            throw ValidationException.fromField("amount", "INVALID",
                    "amount must be greater than 0.");
        }

        if ("PERCENT".equals(type) && req.amount().compareTo(new BigDecimal("100")) > 0) {
            throw ValidationException.fromField("amount", "EXCEEDS_MAX",
                    "Percent discount amount cannot exceed 100.");
        }

        if (req.minimumAmount() != null && req.minimumAmount().compareTo(BigDecimal.ZERO) < 0) {
            throw ValidationException.fromField("minimumAmount", "INVALID",
                    "minimumAmount must be >= 0.");
        }

        if (req.maximumAmount() != null && req.maximumAmount().compareTo(BigDecimal.ZERO) < 0) {
            throw ValidationException.fromField("maximumAmount", "INVALID",
                    "maximumAmount must be >= 0.");
        }

        // Date validation
        if (req.startsAt() != null && req.expiresAt() != null
                && !req.expiresAt().isAfter(req.startsAt())) {
            throw ValidationException.fromField("expiresAt", "INVALID",
                    "expiresAt must be after startsAt.");
        }

        Instant now = Instant.now();
        CouponEntity entity = new CouponEntity();
        entity.setCode(code);
        entity.setName(req.name().trim());
        entity.setDescription(req.description());
        entity.setDiscountType(type);
        entity.setAmount(req.amount());
        entity.setMinAmount(req.minimumAmount());
        entity.setMaxAmount(req.maximumAmount());
        entity.setUsageLimit(req.usageLimit());
        entity.setUsageCount(0);
        entity.setStartsAt(req.startsAt());
        entity.setExpiresAt(req.expiresAt());
        String statusStr = req.status() != null ? req.status().trim().toUpperCase(Locale.ROOT) : "ACTIVE";
        if (!ALLOWED_STATUSES.contains(statusStr)) {
            throw ValidationException.fromField("status", "INVALID",
                    "status must be ACTIVE, INACTIVE, EXPIRED, or ARCHIVED.");
        }
        entity.setStatus(statusStr);
        entity.setMetadata(req.metadata());
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        entity = couponRepo.save(entity);

        auditLogRepo.save(buildAudit(adminId, "COUPON_CREATED", entity.getId(), null,
                "{\"code\":\"" + escapeJson(code) + "\",\"discountType\":\"" + type + "\"}"));

        return toDetail(entity);
    }

    // ── Update ────────────────────────────────────────────────────────────────

    @Transactional
    public AdminCouponDetailResponse updateCoupon(UUID couponId, UUID adminId, UpdateCouponRequest req) {
        CouponEntity entity = couponRepo.findById(couponId)
                .orElseThrow(() -> new NotFoundException("Coupon not found."));

        String before = snapshot(entity);

        // Code uniqueness (if changed)
        if (req.code() != null && !req.code().isBlank()) {
            String newCode = req.code().trim().toUpperCase(Locale.ROOT);
            if (!newCode.equals(entity.getCode())) {
                couponRepo.findByCode(newCode).ifPresent(existing -> {
                    throw new ConflictException("Coupon code '" + newCode + "' already exists.");
                });
                entity.setCode(newCode);
            }
        }

        String type = req.discountType() != null
                ? req.discountType().trim().toUpperCase(Locale.ROOT) : entity.getDiscountType();

        if (req.discountType() != null) {
            if (!ALLOWED_DISCOUNT_TYPES.contains(type)) {
                throw ValidationException.fromField("discountType", "INVALID",
                        "discountType must be FIXED or PERCENT.");
            }
            entity.setDiscountType(type);
        }

        BigDecimal amount = req.amount() != null ? req.amount() : entity.getAmount();
        if (req.amount() != null) {
            if (amount.compareTo(BigDecimal.ZERO) <= 0) {
                throw ValidationException.fromField("amount", "INVALID",
                        "amount must be greater than 0.");
            }
            if ("PERCENT".equals(type) && amount.compareTo(new BigDecimal("100")) > 0) {
                throw ValidationException.fromField("amount", "EXCEEDS_MAX",
                        "Percent discount amount cannot exceed 100.");
            }
            entity.setAmount(amount);
        }

        if (req.name() != null && !req.name().isBlank()) {
            entity.setName(req.name().trim());
        }
        if (req.description() != null) {
            entity.setDescription(req.description());
        }
        if (req.minimumAmount() != null) {
            if (req.minimumAmount().compareTo(BigDecimal.ZERO) < 0) {
                throw ValidationException.fromField("minimumAmount", "INVALID",
                        "minimumAmount must be >= 0.");
            }
            entity.setMinAmount(req.minimumAmount());
        }
        if (req.maximumAmount() != null) {
            if (req.maximumAmount().compareTo(BigDecimal.ZERO) < 0) {
                throw ValidationException.fromField("maximumAmount", "INVALID",
                        "maximumAmount must be >= 0.");
            }
            entity.setMaxAmount(req.maximumAmount());
        }
        if (req.usageLimit() != null) {
            entity.setUsageLimit(req.usageLimit());
        }
        if (req.startsAt() != null) {
            entity.setStartsAt(req.startsAt());
        }
        if (req.expiresAt() != null) {
            entity.setExpiresAt(req.expiresAt());
        }

        Instant effectiveStarts = entity.getStartsAt();
        Instant effectiveExpires = entity.getExpiresAt();
        if (effectiveStarts != null && effectiveExpires != null
                && !effectiveExpires.isAfter(effectiveStarts)) {
            throw ValidationException.fromField("expiresAt", "INVALID",
                    "expiresAt must be after startsAt.");
        }

        if (req.status() != null && !req.status().isBlank()) {
            String updStatus = req.status().trim().toUpperCase(Locale.ROOT);
            if (!ALLOWED_STATUSES.contains(updStatus)) {
                throw ValidationException.fromField("status", "INVALID",
                        "status must be ACTIVE, INACTIVE, EXPIRED, or ARCHIVED.");
            }
            entity.setStatus(updStatus);
        }
        if (req.metadata() != null) {
            entity.setMetadata(req.metadata());
        }
        entity.setUpdatedAt(Instant.now());
        couponRepo.save(entity);

        auditLogRepo.save(buildAudit(adminId, "COUPON_UPDATED", couponId, before, snapshot(entity)));

        return toDetail(entity);
    }

    // ── Update status ─────────────────────────────────────────────────────────

    @Transactional
    public AdminCouponDetailResponse updateCouponStatus(UUID couponId, UUID adminId, UpdateCouponStatusRequest req) {
        CouponEntity entity = couponRepo.findById(couponId)
                .orElseThrow(() -> new NotFoundException("Coupon not found."));

        String newStatus = req.status().trim().toUpperCase(Locale.ROOT);
        if (!ALLOWED_STATUSES.contains(newStatus)) {
            throw ValidationException.fromField("status", "INVALID",
                    "status must be ACTIVE, INACTIVE, EXPIRED, or ARCHIVED.");
        }

        String before = "{\"status\":\"" + entity.getStatus() + "\"}";
        entity.setStatus(newStatus);
        entity.setUpdatedAt(Instant.now());
        couponRepo.save(entity);

        auditLogRepo.save(buildAudit(adminId, "COUPON_STATUS_UPDATED", couponId, before,
                "{\"status\":\"" + newStatus + "\"}"));

        return toDetail(entity);
    }

    // ── Mapping ───────────────────────────────────────────────────────────────

    private AdminCouponListItemResponse toListItem(CouponEntity c) {
        return new AdminCouponListItemResponse(
                c.getId(), c.getCode(), c.getName(), c.getDiscountType(),
                c.getAmount(), c.getStatus(), c.getUsageCount(),
                c.getUsageLimit(), c.getExpiresAt(), c.getCreatedAt()
        );
    }

    private AdminCouponDetailResponse toDetail(CouponEntity c) {
        return new AdminCouponDetailResponse(
                c.getId(), c.getLegacyId(), c.getCode(), c.getName(),
                c.getDescription(), c.getDiscountType(), c.getAmount(),
                c.getMinAmount(), c.getMaxAmount(), c.getUsageLimit(), c.getUsageCount(),
                c.getStartsAt(), c.getExpiresAt(), c.getStatus(),
                c.getMetadata(), c.getCreatedAt(), c.getUpdatedAt()
        );
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private AuditLogEntity buildAudit(UUID adminId, String action, UUID resourceId,
            String before, String after) {
        AuditLogEntity log = new AuditLogEntity();
        log.setActorType("ADMIN");
        log.setActorId(adminId);
        log.setAction(action);
        log.setResourceType("COUPON");
        log.setResourceId(resourceId);
        log.setBeforeData(before);
        log.setAfterData(after);
        log.setCreatedAt(Instant.now());
        return log;
    }

    private static String snapshot(CouponEntity c) {
        return "{\"code\":\"" + escapeJson(c.getCode()) +
               "\",\"discountType\":\"" + c.getDiscountType() +
               "\",\"amount\":" + c.getAmount() +
               ",\"status\":\"" + c.getStatus() + "\"}";
    }

    private static boolean matchesQ(String field, String qLower) {
        return field != null && field.toLowerCase(Locale.ROOT).contains(qLower);
    }

    private static String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
