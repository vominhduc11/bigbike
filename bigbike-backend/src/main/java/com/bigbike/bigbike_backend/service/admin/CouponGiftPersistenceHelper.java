package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.persistence.entity.audit.AuditLogEntity;
import com.bigbike.bigbike_backend.persistence.entity.coupon.CouponEntity;
import com.bigbike.bigbike_backend.persistence.entity.customer.CustomerEntity;
import com.bigbike.bigbike_backend.persistence.repository.audit.AuditLogJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.coupon.CouponJpaRepository;
import com.bigbike.bigbike_backend.service.admin.AdminCouponGiftService.SendCouponGiftRequest;
import java.time.Instant;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Thin persistence helper — exists only so that REQUIRES_NEW propagates through
 * a Spring proxy boundary, avoiding the self-invocation pitfall in AdminCouponGiftService.
 */
@Service
@RequiredArgsConstructor
public class CouponGiftPersistenceHelper {

    private final CouponJpaRepository couponRepo;
    private final AuditLogJpaRepository auditLogRepo;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public CouponEntity createAndPersist(CustomerEntity customer, UUID adminId,
            String discountType, SendCouponGiftRequest req, String channel, Instant expiresAt) {
        String code = generateUniqueCode();
        Instant now = Instant.now();

        CouponEntity coupon = new CouponEntity();
        coupon.setCode(code);
        coupon.setName("Ưu đãi dành riêng cho " + displayName(customer));
        coupon.setDiscountType(discountType);
        coupon.setAmount(req.amount());
        coupon.setMinAmount(req.minimumAmount());
        coupon.setUsageLimit(req.usageLimit() != null ? req.usageLimit() : 1);
        coupon.setUsageCount(0);
        coupon.setExpiresAt(expiresAt);
        coupon.setStatus("ACTIVE");
        coupon.setChannel(channel);
        coupon.setCustomerId(customer.getId());
        coupon.setCreatedAt(now);
        coupon.setUpdatedAt(now);
        coupon = couponRepo.save(coupon);

        AuditLogEntity audit = new AuditLogEntity();
        audit.setActorType("ADMIN");
        audit.setActorId(adminId);
        audit.setAction("COUPON_GIFT_SENT");
        audit.setResourceType("COUPON");
        audit.setResourceId(coupon.getId());
        audit.setAfterData("{\"code\":\"" + code + "\",\"customerId\":\"" + customer.getId() + "\",\"bulk\":true}");
        audit.setCreatedAt(now);
        auditLogRepo.save(audit);

        return coupon;
    }

    private String generateUniqueCode() {
        for (int i = 0; i < 10; i++) {
            String candidate = "GIFT" + UUID.randomUUID().toString().replace("-", "").substring(0, 8)
                    .toUpperCase(java.util.Locale.ROOT);
            if (couponRepo.findByCode(candidate).isEmpty()) return candidate;
        }
        throw new IllegalStateException("Không thể sinh mã coupon duy nhất.");
    }

    private static String displayName(CustomerEntity c) {
        if (c.getDisplayName() != null && !c.getDisplayName().isBlank()) return c.getDisplayName();
        if (c.getEmail() != null) return c.getEmail();
        return "Khách hàng";
    }
}
