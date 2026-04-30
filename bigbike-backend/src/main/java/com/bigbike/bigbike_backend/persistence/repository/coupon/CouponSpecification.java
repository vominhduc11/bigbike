package com.bigbike.bigbike_backend.persistence.repository.coupon;

import com.bigbike.bigbike_backend.persistence.entity.coupon.CouponEntity;
import jakarta.persistence.criteria.Predicate;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.springframework.data.jpa.domain.Specification;

public final class CouponSpecification {

    private CouponSpecification() {}

    public static Specification<CouponEntity> build(
            String q, String status, String discountType, Boolean expired) {

        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            Instant now = Instant.now();

            if (q != null && !q.isBlank()) {
                String pattern = "%" + q.toLowerCase(Locale.ROOT) + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("code")), pattern),
                        cb.like(cb.lower(root.get("name")), pattern)
                ));
            }

            if (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status)) {
                predicates.add(cb.equal(root.get("status"), status.toUpperCase(Locale.ROOT)));
            }

            if (discountType != null && !discountType.isBlank()) {
                predicates.add(cb.equal(root.get("discountType"),
                        discountType.toUpperCase(Locale.ROOT)));
            }

            if (Boolean.TRUE.equals(expired)) {
                predicates.add(cb.and(
                        cb.isNotNull(root.get("expiresAt")),
                        cb.lessThan(root.get("expiresAt"), now)
                ));
            } else if (Boolean.FALSE.equals(expired)) {
                predicates.add(cb.or(
                        cb.isNull(root.get("expiresAt")),
                        cb.greaterThanOrEqualTo(root.get("expiresAt"), now)
                ));
            }

            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }
}
