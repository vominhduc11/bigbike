package com.bigbike.bigbike_backend.migration.wordpress.importer;

import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressProductMapper.MappedProduct;
import com.bigbike.bigbike_backend.migration.wordpress.writeplan.MigrationDomain;
import com.bigbike.bigbike_backend.persistence.entity.catalog.BrandEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.CategoryEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.BrandJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.CategoryJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class ProductImporter implements DomainImporter {

    private final ProductJpaRepository productRepo;
    private final CategoryJpaRepository categoryRepo;
    private final BrandJpaRepository brandRepo;

    public ProductImporter(
            ProductJpaRepository productRepo,
            CategoryJpaRepository categoryRepo,
            BrandJpaRepository brandRepo) {
        this.productRepo = productRepo;
        this.categoryRepo = categoryRepo;
        this.brandRepo = brandRepo;
    }

    @Override
    public MigrationDomain domain() {
        return MigrationDomain.PRODUCTS;
    }

    @Override
    public MigrationExecutionReport.DomainResult execute(MigrationExecutionOptions options) {
        throw new UnsupportedOperationException("Use importBatch()");
    }

    /**
     * Idempotent product import.
     * Upserts by slug. Duplicate SKUs get a "-wp-{id}" suffix to avoid unique constraint violations.
     * Category and brand are resolved from DB by slug after their respective imports complete.
     */
    @Transactional
    public MigrationExecutionReport.DomainResult importBatch(
            List<ResolvedProduct> items, MigrationExecutionOptions options) {

        int inserted = 0, updated = 0, skipped = 0, failed = 0;
        List<String> warnings = new ArrayList<>();
        List<String> errors = new ArrayList<>();
        Set<String> seenSkus = new java.util.HashSet<>();

        for (ResolvedProduct rp : items) {
            MappedProduct mp = rp.product();
            if (mp.slug() == null || mp.slug().isBlank()
                    || mp.name() == null || mp.name().isBlank()) {
                skipped++;
                continue;
            }
            try {
                Optional<ProductEntity> existing = productRepo.findBySlug(mp.slug());
                ProductEntity entity;
                boolean isNew;
                if (existing.isPresent()) {
                    entity = existing.get();
                    isNew = false;
                } else {
                    entity = new ProductEntity();
                    entity.setId("wp-prod-" + mp.sourceId());
                    entity.setCreatedAt(Instant.now());
                    isNew = true;
                }
                entity.setSlug(mp.slug());
                entity.setName(mp.name());
                entity.setDescription(mp.description());

                // Duplicate SKU handling: append suffix to avoid constraint violation
                String sku = mp.sku();
                if (sku != null && !sku.isBlank()) {
                    if (!seenSkus.add(sku.toUpperCase())) {
                        String suffixedSku = sku + "-wp-" + mp.sourceId();
                        warnings.add("Duplicate SKU '" + sku + "' for product id="
                                + mp.sourceId() + "; stored as '" + suffixedSku + "'");
                        sku = suffixedSku;
                    }
                }
                entity.setSku(sku);

                // Price: MappedProduct.price() is BigDecimal; entity.retailPrice is int VND
                int retailPrice = mp.price() != null
                        ? mp.price().intValue()
                        : (mp.regularPrice() != null ? mp.regularPrice().intValue() : 0);
                int compareAtPrice = mp.regularPrice() != null ? mp.regularPrice().intValue() : 0;
                int salePrice = mp.salePrice() != null ? mp.salePrice().intValue() : 0;
                entity.setRetailPrice(retailPrice);
                entity.setCompareAtPrice(compareAtPrice > 0 ? compareAtPrice : null);
                entity.setSalePrice(salePrice > 0 ? salePrice : null);
                entity.setCurrency("VND");

                entity.setStockState(resolveStockState(mp.stockStatus()));
                entity.setPublishStatus(resolveStatus(mp.status()));

                // Category link (required)
                CategoryEntity category = null;
                if (rp.categorySlug() != null) {
                    category = categoryRepo.findBySlug(rp.categorySlug()).orElse(null);
                }
                if (category == null) {
                    // Find or create an "Uncategorized" fallback
                    category = categoryRepo.findBySlug("uncategorized").orElse(null);
                }
                if (category == null && isNew) {
                    warnings.add("No category found for product slug=" + mp.slug()
                            + "; skipping (category FK is required)");
                    skipped++;
                    continue;
                }
                if (category != null) entity.setCategory(category);

                // Brand link (optional)
                if (rp.brandSlug() != null) {
                    brandRepo.findBySlug(rp.brandSlug()).ifPresent(entity::setBrand);
                }

                entity.setUpdatedAt(Instant.now());
                warnings.addAll(mp.warnings());

                if (!options.dryRun()) {
                    productRepo.save(entity);
                }
                if (isNew) inserted++; else updated++;
            } catch (Exception e) {
                failed++;
                errors.add("Product slug=" + mp.slug() + ": " + e.getMessage());
                if (options.failFast()) throw new RuntimeException(errors.get(errors.size() - 1), e);
            }
        }
        return new MigrationExecutionReport.DomainResult(
                MigrationDomain.PRODUCTS, inserted, updated, skipped, failed, warnings, errors);
    }

    private ProductStockState resolveStockState(String status) {
        if (status == null) return ProductStockState.IN_STOCK;
        return switch (status.toLowerCase()) {
            case "outofstock", "out_of_stock" -> ProductStockState.OUT_OF_STOCK;
            case "onbackorder" -> ProductStockState.PREORDER;
            default -> ProductStockState.IN_STOCK;
        };
    }

    private PublishStatus resolveStatus(String status) {
        if (status == null) return PublishStatus.DRAFT;
        return switch (status.toUpperCase()) {
            case "ACTIVE", "PUBLISHED" -> PublishStatus.PUBLISHED;
            case "ARCHIVED" -> PublishStatus.ARCHIVED;
            default -> PublishStatus.DRAFT;
        };
    }

    /** Carries a mapped product plus resolved category/brand slugs for DB lookup. */
    public record ResolvedProduct(
            MappedProduct product,
            String categorySlug,
            String brandSlug) {}
}
