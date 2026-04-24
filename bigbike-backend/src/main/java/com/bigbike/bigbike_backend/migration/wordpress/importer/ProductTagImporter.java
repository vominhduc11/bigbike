package com.bigbike.bigbike_backend.migration.wordpress.importer;

import com.bigbike.bigbike_backend.migration.wordpress.writeplan.MigrationDomain;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductTagEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductTagJpaRepository;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class ProductTagImporter implements DomainImporter {

    public record MappedProductTag(
            long sourceId,
            String slug,
            String name,
            String productId
    ) {}

    private final ProductJpaRepository productRepo;
    private final ProductTagJpaRepository tagRepo;

    public ProductTagImporter(ProductJpaRepository productRepo, ProductTagJpaRepository tagRepo) {
        this.productRepo = productRepo;
        this.tagRepo = tagRepo;
    }

    @Override
    public MigrationDomain domain() {
        return MigrationDomain.PRODUCT_TAGS;
    }

    @Override
    public MigrationExecutionReport.DomainResult execute(MigrationExecutionOptions options) {
        throw new UnsupportedOperationException("Use importBatch()");
    }

    @Transactional
    public MigrationExecutionReport.DomainResult importBatch(
            List<MappedProductTag> items, MigrationExecutionOptions options) {

        int inserted = 0, updated = 0, skipped = 0, failed = 0;
        List<String> warnings = new ArrayList<>();
        List<String> errors = new ArrayList<>();

        for (MappedProductTag item : items) {
            if (item.productId() == null || item.productId().isBlank()
                    || item.slug() == null || item.slug().isBlank()) {
                skipped++;
                continue;
            }
            try {
                ProductTagEntity tag = resolveTag(item, options.dryRun());
                Optional<ProductEntity> productOpt = productRepo.findById(item.productId());
                if (productOpt.isEmpty()) {
                    skipped++;
                    continue;
                }
                ProductEntity product = productOpt.get();
                if (product.getTags() == null) {
                    product.setTags(new LinkedHashSet<>());
                }
                product.getTags().add(tag);
                tag.getProducts().add(product);

                warnings.add("Product tag linked: " + item.slug() + " -> " + item.productId());
                if (!options.dryRun()) {
                    productRepo.save(product);
                    tagRepo.save(tag);
                }
                inserted++;
            } catch (Exception e) {
                failed++;
                String msg = "ProductTag " + item.productId() + "/" + item.slug() + ": " + e.getMessage();
                errors.add(msg);
                if (options.failFast()) {
                    throw new RuntimeException(msg, e);
                }
            }
        }

        return new MigrationExecutionReport.DomainResult(
                MigrationDomain.PRODUCT_TAGS, inserted, updated, skipped, failed, warnings, errors);
    }

    private ProductTagEntity resolveTag(MappedProductTag item, boolean dryRun) {
        String tagId = "wp-product-tag-" + item.sourceId();
        return tagRepo.findBySlug(item.slug()).orElseGet(() -> tagRepo.findById(tagId).orElseGet(() -> {
            ProductTagEntity entity = new ProductTagEntity();
            entity.setId(tagId);
            entity.setSlug(item.slug());
            entity.setName(item.name() == null || item.name().isBlank() ? item.slug() : item.name());
            return dryRun ? entity : tagRepo.save(entity);
        }));
    }
}
