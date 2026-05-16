package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.coupon.AdminCouponDetailResponse;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.mapper.CouponMapper;
import com.bigbike.bigbike_backend.persistence.entity.coupon.CouponEntity;
import com.bigbike.bigbike_backend.persistence.entity.customer.CustomerEntity;
import com.bigbike.bigbike_backend.persistence.repository.customer.CustomerJpaRepository;
import jakarta.validation.constraints.NotBlank;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdminCouponGiftService {

    private static final int BULK_WARN_THRESHOLD = 500;

    private final CustomerJpaRepository customerRepo;
    private final CouponMapper couponMapper;
    private final CouponGiftEmailService couponGiftEmailService;
    private final CouponGiftPersistenceHelper persistenceHelper;

    public record SendCouponGiftRequest(
            @NotBlank String discountType,   // FIXED | PERCENT
            BigDecimal amount,
            BigDecimal minimumAmount,
            Integer validDays,               // null = không hết hạn
            Integer usageLimit,              // null = không giới hạn lượt
            String channel                   // ALL | ONLINE | POS — default ALL
    ) {}

    public record BulkCouponGiftResult(int sent, int skipped) {}

    public AdminCouponDetailResponse sendCouponGift(UUID customerId, UUID adminId, SendCouponGiftRequest req) {
        CustomerEntity customer = customerRepo.findById(customerId)
                .orElseThrow(() -> new NotFoundException("Khách hàng không tồn tại."));

        if (customer.getEmail() == null || customer.getEmail().isBlank()) {
            throw new com.bigbike.bigbike_backend.api.error.ConflictException(
                    "Khách hàng chưa có email — không thể gửi mã giảm giá.");
        }

        String discountType = normalizeType(req.discountType());
        validateAmount(req.amount(), discountType);

        String channel = req.channel() != null ? req.channel().trim().toUpperCase(Locale.ROOT) : "ALL";
        Instant expiresAt = req.validDays() != null && req.validDays() > 0
                ? Instant.now().plus(req.validDays(), ChronoUnit.DAYS) : null;

        CouponEntity coupon = persistenceHelper.createAndPersist(customer, adminId, discountType, req, channel, expiresAt);
        couponGiftEmailService.sendGiftEmail(customer, coupon);

        return couponMapper.toDetail(coupon);
    }

    public BulkCouponGiftResult sendBulkCouponGift(UUID adminId, SendCouponGiftRequest req) {
        String discountType = normalizeType(req.discountType());
        validateAmount(req.amount(), discountType);

        Specification<CustomerEntity> spec = (root, query, cb) -> cb.and(
                cb.equal(root.get("status"), "ACTIVE"),
                cb.isNotNull(root.get("email")),
                cb.notEqual(root.get("email"), "")
        );
        List<CustomerEntity> customers = customerRepo.findAll(spec);

        if (customers.size() >= BULK_WARN_THRESHOLD) {
            log.warn("Bulk coupon gift: sending to {} customers — large batch may take time", customers.size());
        }

        String channel = req.channel() != null ? req.channel().trim().toUpperCase(Locale.ROOT) : "ALL";
        Instant expiresAt = req.validDays() != null && req.validDays() > 0
                ? Instant.now().plus(req.validDays(), ChronoUnit.DAYS) : null;

        int sent = 0;
        int skipped = 0;

        for (CustomerEntity customer : customers) {
            if (customer.getEmail() == null || customer.getEmail().isBlank()) {
                skipped++;
                continue;
            }
            try {
                CouponEntity coupon = persistenceHelper.createAndPersist(
                        customer, adminId, discountType, req, channel, expiresAt);
                couponGiftEmailService.sendGiftEmail(customer, coupon);
                sent++;
            } catch (Exception e) {
                log.warn("Bulk gift skipped customer {}: {}", customer.getId(), e.getMessage());
                skipped++;
            }
        }

        return new BulkCouponGiftResult(sent, skipped);
    }

    private static String normalizeType(String raw) {
        if (raw == null) return "FIXED";
        String upper = raw.trim().toUpperCase(Locale.ROOT);
        return "FIXED_AMOUNT".equals(upper) ? "FIXED" : upper;
    }

    private static void validateAmount(BigDecimal amount, String type) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw com.bigbike.bigbike_backend.api.error.ValidationException.fromField(
                    "amount", "INVALID", "amount phải lớn hơn 0.");
        }
        if ("PERCENT".equals(type) && amount.compareTo(new BigDecimal("100")) > 0) {
            throw com.bigbike.bigbike_backend.api.error.ValidationException.fromField(
                    "amount", "EXCEEDS_MAX", "Giảm % không được vượt quá 100.");
        }
    }

}
