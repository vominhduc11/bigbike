package com.bigbike.bigbike_backend.service.coupon;

import com.bigbike.bigbike_backend.persistence.repository.coupon.CouponJpaRepository;
import java.time.Instant;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class CouponExpiryScheduler {

    private final CouponJpaRepository couponRepo;

    public CouponExpiryScheduler(CouponJpaRepository couponRepo) {
        this.couponRepo = couponRepo;
    }

    // Runs every hour — flips ACTIVE coupons whose expiresAt has passed to EXPIRED
    @Scheduled(cron = "0 0 * * * *")
    @Transactional
    public void expireOverdueCoupons() {
        int updated = couponRepo.expireOverdue(Instant.now());
        if (updated > 0) {
            org.slf4j.LoggerFactory.getLogger(CouponExpiryScheduler.class)
                    .info("Auto-expired {} coupon(s).", updated);
        }
    }
}
