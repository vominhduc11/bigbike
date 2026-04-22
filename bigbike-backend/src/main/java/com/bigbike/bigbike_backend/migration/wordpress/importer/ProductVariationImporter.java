package com.bigbike.bigbike_backend.migration.wordpress.importer;

import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressVariationMapper.MappedVariation;
import com.bigbike.bigbike_backend.migration.wordpress.writeplan.MigrationDomain;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantOptionEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductVariantJpaRepository;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Idempotent product variation importer.
 * Variant ID is deterministic: "wp-var-{sourceId}" — no @GeneratedValue used.
 * Parent product is required; variations with missing parent are skipped with a warning.
 * Options (attributes) are fully replaced on each run via orphanRemoval=true.
 */
@Component
public class ProductVariationImporter implements DomainImporter {

    private final ProductVariantJpaRepository variantRepo;
    private final ProductJpaRepository productRepo;

    public ProductVariationImporter(
            ProductVariantJpaRepository variantRepo,
            ProductJpaRepository productRepo) {
        this.variantRepo = variantRepo;
        this.productRepo = productRepo;
    }

    @Override
    public MigrationDomain domain() {
        return MigrationDomain.PRODUCT_VARIATIONS;
    }

    @Override
    public MigrationExecutionReport.DomainResult execute(MigrationExecutionOptions options) {
        throw new UnsupportedOperationException("Use importBatch()");
    }

    @Transactional
    public MigrationExecutionReport.DomainResult importBatch(
            List<MappedVariation> items, MigrationExecutionOptions options) {

        int inserted = 0, updated = 0, skipped = 0, failed = 0;
        List<String> warnings = new ArrayList<>();
        List<String> errors = new ArrayList<>();

        for (MappedVariation mv : items) {
            try {
                String variantId = "wp-var-" + mv.sourceId();
                String parentProductId = "wp-prod-" + mv.parentProductId();

                Optional<ProductEntity> parentOpt = productRepo.findById(parentProductId);
                if (parentOpt.isEmpty()) {
                    warnings.add("Skipping variation sourceId=" + mv.sourceId()
                            + ": parent product not found (parentProductId=" + mv.parentProductId() + ")");
                    skipped++;
                    continue;
                }
                ProductEntity parent = parentOpt.get();

                Optional<ProductVariantEntity> existing = variantRepo.findById(variantId);
                ProductVariantEntity entity;
                boolean isNew;
                if (existing.isPresent()) {
                    entity = existing.get();
                    isNew = false;
                } else {
                    entity = new ProductVariantEntity();
                    entity.setId(variantId);
                    isNew = true;
                }

                entity.setProduct(parent);
                entity.setSku(mv.sku());
                entity.setName(buildName(mv));

                BigDecimal retailPrice = mv.price() != null
                        ? mv.price()
                        : mv.regularPrice();
                BigDecimal compareAtPrice = mv.regularPrice();
                BigDecimal salePrice = mv.salePrice();
                entity.setRetailPrice(retailPrice != null && retailPrice.signum() > 0 ? retailPrice : null);
                entity.setCompareAtPrice(compareAtPrice != null && compareAtPrice.signum() > 0 ? compareAtPrice : null);
                entity.setSalePrice(salePrice != null && salePrice.signum() > 0 ? salePrice : null);
                entity.setCurrency("VND");

                ProductStockState stockState = resolveStockState(mv.stockStatus());
                entity.setStockState(stockState);
                entity.setAvailable("ACTIVE".equals(mv.status()) && stockState == ProductStockState.IN_STOCK);
                entity.setSortOrder(0);

                warnings.addAll(mv.warnings());

                if (!options.dryRun()) {
                    List<ProductVariantOptionEntity> newOpts = buildOptions(entity, mv.attributes());
                    if (isNew) {
                        entity.setOptions(newOpts);
                        variantRepo.save(entity);
                    } else {
                        // Save state changes first
                        entity = variantRepo.save(entity);
                        // Use the Hibernate-managed collection so orphanRemoval tracks correctly
                        List<ProductVariantOptionEntity> managed = entity.getOptions();
                        if (managed == null) {
                            entity.setOptions(newOpts);
                        } else {
                            managed.clear();
                            // Re-point variant reference to the now-managed entity
                            for (ProductVariantOptionEntity o : newOpts) o.setVariant(entity);
                            managed.addAll(newOpts);
                        }
                        variantRepo.save(entity);
                    }
                }

                if (isNew) inserted++; else updated++;
            } catch (Exception e) {
                failed++;
                errors.add("Variation sourceId=" + mv.sourceId() + ": " + e.getMessage());
                if (options.failFast()) throw new RuntimeException(errors.get(errors.size() - 1), e);
            }
        }

        return new MigrationExecutionReport.DomainResult(
                MigrationDomain.PRODUCT_VARIATIONS, inserted, updated, skipped, failed, warnings, errors);
    }

    private String buildName(MappedVariation mv) {
        if (mv.attributes() == null || mv.attributes().isEmpty()) {
            return "Biến thể " + mv.sourceId();
        }
        StringBuilder sb = new StringBuilder();
        for (Map.Entry<String, String> e : mv.attributes().entrySet()) {
            if (sb.length() > 0) sb.append(", ");
            sb.append(e.getKey()).append(": ").append(e.getValue());
        }
        return sb.toString();
    }

    private List<ProductVariantOptionEntity> buildOptions(
            ProductVariantEntity variant, Map<String, String> attributes) {
        if (attributes == null || attributes.isEmpty()) return new ArrayList<>();
        List<ProductVariantOptionEntity> result = new ArrayList<>();
        AtomicInteger sort = new AtomicInteger(0);
        for (Map.Entry<String, String> e : attributes.entrySet()) {
            ProductVariantOptionEntity opt = new ProductVariantOptionEntity();
            opt.setVariant(variant);
            opt.setOptionName(e.getKey());
            opt.setOptionValue(e.getValue() != null ? e.getValue() : "");
            opt.setSortOrder(sort.getAndIncrement());
            result.add(opt);
        }
        return result;
    }

    private ProductStockState resolveStockState(String stockStatus) {
        if (stockStatus == null) return ProductStockState.IN_STOCK;
        return switch (stockStatus.toLowerCase()) {
            case "outofstock", "out_of_stock" -> ProductStockState.OUT_OF_STOCK;
            case "onbackorder" -> ProductStockState.PREORDER;
            default -> ProductStockState.IN_STOCK;
        };
    }
}
