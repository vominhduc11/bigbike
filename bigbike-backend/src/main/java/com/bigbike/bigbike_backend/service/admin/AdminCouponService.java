package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.coupon.AdminCouponDetailResponse;
import com.bigbike.bigbike_backend.api.admin.dto.coupon.AdminCouponListItemResponse;
import com.bigbike.bigbike_backend.api.admin.dto.coupon.CreateCouponRequest;
import com.bigbike.bigbike_backend.api.admin.dto.coupon.UpdateCouponRequest;
import com.bigbike.bigbike_backend.api.admin.dto.coupon.UpdateCouponStatusRequest;
import com.bigbike.bigbike_backend.api.error.ConflictException;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.mapper.CouponMapper;
import com.bigbike.bigbike_backend.persistence.entity.audit.AuditLogEntity;
import com.bigbike.bigbike_backend.persistence.entity.coupon.CouponEntity;
import com.bigbike.bigbike_backend.persistence.repository.audit.AuditLogJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.coupon.CouponJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.coupon.CouponSpecification;
import com.bigbike.bigbike_backend.service.common.PageResult;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AdminCouponService {

    private static final int DEFAULT_SIZE = 20;
    private static final int MAX_SIZE = 100;
    // Canonical stored value is FIXED; accept FIXED_AMOUNT from clients for backward compat
    private static final Set<String> ALLOWED_DISCOUNT_TYPES = Set.of("FIXED", "PERCENT", "FIXED_AMOUNT");
    private static final Set<String> ALLOWED_STATUSES = Set.of("ACTIVE", "INACTIVE", "EXPIRED", "ARCHIVED");
    private static final Set<String> ALLOWED_CHANNELS = Set.of("ALL", "ONLINE", "POS");

    private final CouponJpaRepository couponRepo;
    private final AuditLogJpaRepository auditLogRepo;
    private final CouponMapper couponMapper;

    // ── List ──────────────────────────────────────────────────────────────────

    public PageResult<AdminCouponListItemResponse> listCoupons(
            int page, int size, String q, String code, String status,
            String discountType, Boolean expired
    ) {
        int normalizedPage = Math.max(1, page);
        int normalizedSize = (size <= 0) ? DEFAULT_SIZE : Math.min(size, MAX_SIZE);

        // code filter folds into q when present
        String effectiveQ = (code != null && !code.isBlank()) ? code : q;

        Specification<CouponEntity> spec = CouponSpecification.build(effectiveQ, status, discountType, expired);
        Pageable pageable = PageRequest.of(
                normalizedPage - 1, normalizedSize,
                Sort.by(Sort.Direction.DESC, "createdAt")
        );

        Page<CouponEntity> pageResult = couponRepo.findAll(spec, pageable);
        List<AdminCouponListItemResponse> items = pageResult.getContent()
                .stream()
                .map(this::toListItem)
                .toList();

        long totalItems = pageResult.getTotalElements();
        int totalPages = pageResult.getTotalPages() == 0 ? 1 : pageResult.getTotalPages();
        return new PageResult<>(items, normalizedPage, normalizedSize, totalItems, totalPages);
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
        String type = normalizeDiscountType(req.discountType());

        couponRepo.findByCode(code).ifPresent(existing -> {
            throw new ConflictException("Coupon code '" + code + "' already exists.");
        });

        if (!ALLOWED_DISCOUNT_TYPES.contains(req.discountType().trim().toUpperCase(Locale.ROOT))) {
            throw ValidationException.fromField("discountType", "INVALID",
                    "discountType must be FIXED or PERCENT.");
        }

        validateAmount(req.amount(), type);
        validateMinMaxAmounts(req.minimumAmount(), req.maximumAmount(), req.amount(), type);
        validateUsageLimit(req.usageLimit());
        validateDates(req.startsAt(), req.expiresAt());

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
        String channelStr = req.channel() != null ? req.channel().trim().toUpperCase(Locale.ROOT) : "ALL";
        if (!ALLOWED_CHANNELS.contains(channelStr)) {
            throw ValidationException.fromField("channel", "INVALID",
                    "channel must be ALL, ONLINE, or POS.");
        }
        entity.setChannel(channelStr);
        entity.setMetadata(req.metadata());
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        entity = couponRepo.save(entity);

        auditLogRepo.save(buildAudit(adminId, "COUPON_CREATED", entity.getId(), null, snapshotFull(entity)));
        return toDetail(entity);
    }

    // ── Update ────────────────────────────────────────────────────────────────

    @Transactional
    public AdminCouponDetailResponse updateCoupon(UUID couponId, UUID adminId, UpdateCouponRequest req) {
        CouponEntity entity = couponRepo.findById(couponId)
                .orElseThrow(() -> new NotFoundException("Coupon not found."));

        String before = snapshotFull(entity);

        if (req.code() != null && !req.code().isBlank()) {
            String newCode = req.code().trim().toUpperCase(Locale.ROOT);
            if (!newCode.equals(entity.getCode())) {
                couponRepo.findByCode(newCode).ifPresent(existing -> {
                    throw new ConflictException("Coupon code '" + newCode + "' already exists.");
                });
                entity.setCode(newCode);
            }
        }

        String type = entity.getDiscountType();
        if (req.discountType() != null && !req.discountType().isBlank()) {
            type = normalizeDiscountType(req.discountType());
            if (!ALLOWED_DISCOUNT_TYPES.contains(req.discountType().trim().toUpperCase(Locale.ROOT))) {
                throw ValidationException.fromField("discountType", "INVALID",
                        "discountType must be FIXED or PERCENT.");
            }
            entity.setDiscountType(type);
            // P0-COUPON-03: when only discountType changes, the existing amount must still be valid
            // e.g. switching FIXED→PERCENT with amount=200000 would violate the ≤100 rule
            if (req.amount() == null) {
                validateAmount(entity.getAmount(), type);
            }
        }

        if (req.amount() != null) {
            validateAmount(req.amount(), type);
            entity.setAmount(req.amount());
        }

        BigDecimal effectiveMin = req.minimumAmount() != null ? req.minimumAmount() : entity.getMinAmount();
        BigDecimal effectiveMax = req.maximumAmount() != null ? req.maximumAmount() : entity.getMaxAmount();
        BigDecimal effectiveAmount = entity.getAmount();
        validateMinMaxAmounts(effectiveMin, effectiveMax, effectiveAmount, type);

        if (req.name() != null && !req.name().isBlank()) {
            entity.setName(req.name().trim());
        }
        if (req.description() != null) {
            entity.setDescription(req.description());
        }
        if (req.minimumAmount() != null) {
            entity.setMinAmount(req.minimumAmount());
        }
        if (req.maximumAmount() != null) {
            entity.setMaxAmount(req.maximumAmount());
        }
        if (req.usageLimit() != null) {
            validateUsageLimit(req.usageLimit());
            entity.setUsageLimit(req.usageLimit());
        }
        if (req.startsAt() != null) {
            entity.setStartsAt(req.startsAt());
        }
        if (req.expiresAt() != null) {
            entity.setExpiresAt(req.expiresAt());
        }

        validateDates(entity.getStartsAt(), entity.getExpiresAt());

        if (req.status() != null && !req.status().isBlank()) {
            String updStatus = req.status().trim().toUpperCase(Locale.ROOT);
            if (!ALLOWED_STATUSES.contains(updStatus)) {
                throw ValidationException.fromField("status", "INVALID",
                        "status must be ACTIVE, INACTIVE, EXPIRED, or ARCHIVED.");
            }
            entity.setStatus(updStatus);
        }
        if (req.channel() != null && !req.channel().isBlank()) {
            String updChannel = req.channel().trim().toUpperCase(Locale.ROOT);
            if (!ALLOWED_CHANNELS.contains(updChannel)) {
                throw ValidationException.fromField("channel", "INVALID",
                        "channel must be ALL, ONLINE, or POS.");
            }
            entity.setChannel(updChannel);
        }
        if (req.metadata() != null) {
            entity.setMetadata(req.metadata());
        }
        entity.setUpdatedAt(Instant.now());
        couponRepo.save(entity);

        auditLogRepo.save(buildAudit(adminId, "COUPON_UPDATED", couponId, before, snapshotFull(entity)));
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
        return couponMapper.toListItem(c);
    }

    private AdminCouponDetailResponse toDetail(CouponEntity c) {
        return couponMapper.toDetail(c);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static String normalizeDiscountType(String raw) {
        if (raw == null) return "FIXED";
        String upper = raw.trim().toUpperCase(Locale.ROOT);
        return "FIXED_AMOUNT".equals(upper) ? "FIXED" : upper;
    }

    private static void validateAmount(BigDecimal amount, String type) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw ValidationException.fromField("amount", "INVALID", "amount must be greater than 0.");
        }
        if ("PERCENT".equals(type) && amount.compareTo(new BigDecimal("100")) > 0) {
            throw ValidationException.fromField("amount", "EXCEEDS_MAX",
                    "Percent discount amount cannot exceed 100.");
        }
    }

    private static void validateMinMaxAmounts(BigDecimal min, BigDecimal max, BigDecimal amount, String type) {
        if (min != null && min.compareTo(BigDecimal.ZERO) < 0) {
            throw ValidationException.fromField("minimumAmount", "INVALID", "minimumAmount must be >= 0.");
        }
        if (max != null) {
            if (max.compareTo(BigDecimal.ZERO) <= 0) {
                throw ValidationException.fromField("maximumAmount", "INVALID", "maximumAmount must be > 0.");
            }
            // For FIXED coupons, cap must not be lower than the discount amount itself
            if ("FIXED".equals(type) && amount != null && max.compareTo(amount) < 0) {
                throw ValidationException.fromField("maximumAmount", "INVALID",
                        "maximumAmount cannot be less than amount for a FIXED discount.");
            }
        }
    }

    private static void validateUsageLimit(Integer usageLimit) {
        if (usageLimit != null && usageLimit < 0) {
            throw ValidationException.fromField("usageLimit", "INVALID", "usageLimit must be >= 0.");
        }
    }

    private static void validateDates(Instant startsAt, Instant expiresAt) {
        if (startsAt != null && expiresAt != null && !expiresAt.isAfter(startsAt)) {
            throw ValidationException.fromField("expiresAt", "INVALID", "expiresAt must be after startsAt.");
        }
    }

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

    private static String snapshotFull(CouponEntity c) {
        return "{\"code\":\"" + escapeJson(c.getCode()) +
               "\",\"name\":\"" + escapeJson(c.getName()) +
               "\",\"discountType\":\"" + c.getDiscountType() +
               "\",\"amount\":" + c.getAmount() +
               ",\"minimumAmount\":" + (c.getMinAmount() != null ? c.getMinAmount() : "null") +
               ",\"maximumAmount\":" + (c.getMaxAmount() != null ? c.getMaxAmount() : "null") +
               ",\"usageLimit\":" + (c.getUsageLimit() != null ? c.getUsageLimit() : "null") +
               ",\"usageCount\":" + c.getUsageCount() +
               ",\"expiresAt\":\"" + (c.getExpiresAt() != null ? c.getExpiresAt() : "") +
               "\",\"status\":\"" + c.getStatus() + "\"}";
    }

    private static String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
