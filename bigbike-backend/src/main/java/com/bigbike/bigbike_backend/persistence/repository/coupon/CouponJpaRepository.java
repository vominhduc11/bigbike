package com.bigbike.bigbike_backend.persistence.repository.coupon;

import com.bigbike.bigbike_backend.persistence.entity.coupon.CouponEntity;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CouponJpaRepository extends JpaRepository<CouponEntity, UUID> {

    Optional<CouponEntity> findByCode(String code);

    Optional<CouponEntity> findByLegacyId(Long legacyId);
}
