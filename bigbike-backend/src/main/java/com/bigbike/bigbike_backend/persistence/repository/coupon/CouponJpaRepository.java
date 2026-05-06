package com.bigbike.bigbike_backend.persistence.repository.coupon;

import com.bigbike.bigbike_backend.persistence.entity.coupon.CouponEntity;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CouponJpaRepository
        extends JpaRepository<CouponEntity, UUID>, JpaSpecificationExecutor<CouponEntity> {

    Optional<CouponEntity> findByCode(String code);

    Optional<CouponEntity> findByLegacyId(Long legacyId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM CouponEntity c WHERE c.code = :code")
    Optional<CouponEntity> findByCodeForUpdate(@Param("code") String code);

    @Modifying
    @Query("UPDATE CouponEntity c SET c.status = 'EXPIRED', c.updatedAt = :now "
            + "WHERE c.status = 'ACTIVE' AND c.expiresAt IS NOT NULL AND c.expiresAt < :now")
    int expireOverdue(@Param("now") Instant now);

    @Modifying
    @Query("UPDATE CouponEntity c SET c.usageCount = c.usageCount + 1, c.updatedAt = :now "
            + "WHERE c.id = :id "
            + "AND c.status = 'ACTIVE' "
            + "AND (c.startsAt IS NULL OR c.startsAt <= :now) "
            + "AND (c.expiresAt IS NULL OR c.expiresAt >= :now) "
            + "AND (c.usageLimit IS NULL OR c.usageCount < c.usageLimit)")
    int attemptRedeem(@Param("id") UUID id, @Param("now") Instant now);
}
