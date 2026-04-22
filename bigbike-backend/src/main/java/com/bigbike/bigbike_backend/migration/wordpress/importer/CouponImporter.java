package com.bigbike.bigbike_backend.migration.wordpress.importer;

import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressCouponMapper.MappedCoupon;
import com.bigbike.bigbike_backend.migration.wordpress.writeplan.MigrationDomain;
import com.bigbike.bigbike_backend.persistence.entity.coupon.CouponEntity;
import com.bigbike.bigbike_backend.persistence.repository.coupon.CouponJpaRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class CouponImporter implements DomainImporter {

    private final CouponJpaRepository repo;

    public CouponImporter(CouponJpaRepository repo) {
        this.repo = repo;
    }

    @Override
    public MigrationDomain domain() {
        return MigrationDomain.COUPONS;
    }

    @Override
    public MigrationExecutionReport.DomainResult execute(MigrationExecutionOptions options) {
        throw new UnsupportedOperationException("Use importBatch()");
    }

    @Transactional
    public MigrationExecutionReport.DomainResult importBatch(
            List<MappedCoupon> items, MigrationExecutionOptions options) {

        int inserted = 0, updated = 0, skipped = 0, failed = 0;
        List<String> warnings = new ArrayList<>();
        List<String> errors = new ArrayList<>();

        for (MappedCoupon mc : items) {
            if (mc.code() == null || mc.code().isBlank()) {
                skipped++;
                continue;
            }
            try {
                Optional<CouponEntity> byLegacy = mc.sourceId() != 0
                        ? repo.findByLegacyId(mc.sourceId()) : Optional.empty();
                Optional<CouponEntity> byCode = repo.findByCode(mc.code());

                CouponEntity entity;
                boolean isNew;
                if (byLegacy.isPresent()) {
                    entity = byLegacy.get();
                    isNew = false;
                } else if (byCode.isPresent()) {
                    entity = byCode.get();
                    isNew = false;
                } else {
                    entity = new CouponEntity();
                    entity.setCreatedAt(Instant.now());
                    isNew = true;
                }
                entity.setLegacyId(mc.sourceId());
                entity.setCode(mc.code());
                entity.setName(mc.name() != null && !mc.name().isBlank() ? mc.name() : mc.code());
                entity.setDescription(mc.description());
                entity.setDiscountType(mc.discountType() != null ? mc.discountType() : "FIXED");
                entity.setAmount(mc.amount() != null ? mc.amount() : BigDecimal.ZERO);
                entity.setMinAmount(mc.minimumAmount());
                entity.setMaxAmount(mc.maximumAmount());
                entity.setUsageLimit(mc.usageLimit());
                entity.setUsageCount(mc.usageCount());
                if (mc.expiresAt() != null) {
                    entity.setExpiresAt(mc.expiresAt());
                }
                entity.setStatus(mc.status() != null ? mc.status() : "ACTIVE");
                entity.setUpdatedAt(Instant.now());
                warnings.addAll(mc.warnings());

                if (!options.dryRun()) {
                    repo.save(entity);
                }
                if (isNew) inserted++; else updated++;
            } catch (Exception e) {
                failed++;
                errors.add("Coupon code=" + mc.code() + ": " + e.getMessage());
                if (options.failFast()) throw new RuntimeException(errors.get(errors.size() - 1), e);
            }
        }
        return new MigrationExecutionReport.DomainResult(
                MigrationDomain.COUPONS, inserted, updated, skipped, failed, warnings, errors);
    }
}
