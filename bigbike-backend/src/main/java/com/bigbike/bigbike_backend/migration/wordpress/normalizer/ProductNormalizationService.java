package com.bigbike.bigbike_backend.migration.wordpress.normalizer;

import com.bigbike.bigbike_backend.migration.wordpress.importer.ProductImporter.ResolvedProduct;
import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressProductMapper.MappedProduct;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Normalizes a list of ResolvedProducts before import:
 *
 *   1. Slug recovery — products with a blank slug get a deterministic generated slug.
 *      Uniqueness is enforced within the batch and against the DB.
 *      If the generated slug collides, "-{legacyId}" is appended (always unique).
 *
 *   2. Category recovery — products with no category mapping are assigned to "uncategorized".
 *      The "uncategorized" category is created in the DB if it does not exist.
 *
 * Rules:
 *   - Valid slugs (non-blank) are NEVER overwritten.
 *   - "uncategorized" is ONLY used when the product has no category — never randomly assigned.
 *   - Products with blank name AND blank slug remain unrecoverable (still skipped by importer).
 *   - All normalization is deterministic → idempotency preserved across multiple import runs.
 */
@Service
public class ProductNormalizationService {

    private static final Logger log = LoggerFactory.getLogger(ProductNormalizationService.class);

    private final ProductSlugGenerator slugGenerator;
    private final ProductCategoryResolver categoryResolver;
    private final ProductJpaRepository productRepo;

    public ProductNormalizationService(
            ProductSlugGenerator slugGenerator,
            ProductCategoryResolver categoryResolver,
            ProductJpaRepository productRepo) {
        this.slugGenerator = slugGenerator;
        this.categoryResolver = categoryResolver;
        this.productRepo = productRepo;
    }

    /**
     * Result carrier: normalized products + statistics.
     */
    public record NormalizationResult(
            List<ResolvedProduct> products,
            int recoveredSlugCount,
            int recoveredCategoryCount) {}

    /**
     * Normalize the product list.
     * Idempotent — the same list always produces the same normalized output.
     */
    @Transactional
    public NormalizationResult normalize(List<ResolvedProduct> products) {
        // Ensure fallback category exists before any product is processed
        String fallbackCategory = categoryResolver.ensureUncategorized();

        // Pre-populate batchSlugs with slugs from products that already have valid slugs,
        // so we detect collisions between blank-slug products and valid-slug products in the same batch.
        Set<String> batchSlugs = new HashSet<>();
        for (ResolvedProduct rp : products) {
            String s = rp.product().slug();
            if (s != null && !s.isBlank()) {
                batchSlugs.add(s.toLowerCase());
            }
        }

        List<ResolvedProduct> result = new ArrayList<>(products.size());
        int recoveredSlug = 0;
        int recoveredCategory = 0;

        for (ResolvedProduct rp : products) {
            MappedProduct mp = rp.product();
            String slug = mp.slug();
            String categorySlug = rp.categorySlug();
            List<String> warnings = new ArrayList<>(mp.warnings());

            // ── Slug normalization ──────────────────────────────────────────
            if (slug == null || slug.isBlank()) {
                String candidate = slugGenerator.generate(mp.name(), mp.sourceId());

                // Resolve collision: batch-level then DB-level.
                // DB collision is only real if the slug belongs to a DIFFERENT product —
                // if it belongs to this same product (same legacyId), we keep the slug as-is
                // so the importer finds and updates rather than inserting a duplicate.
                boolean inBatch = batchSlugs.contains(candidate);
                boolean inDb = false;
                if (!inBatch) {
                    var dbProduct = productRepo.findBySlug(candidate);
                    inDb = dbProduct.isPresent()
                            && !dbProduct.get().getId().equals("wp-prod-" + mp.sourceId());
                }
                if (inBatch || inDb) {
                    candidate = slugGenerator.withSuffix(candidate, mp.sourceId());
                }
                batchSlugs.add(candidate);
                slug = candidate;
                recoveredSlug++;
                warnings.add("Slug generated: '" + slug + "' for sourceId=" + mp.sourceId());
            }

            // ── Category normalization ──────────────────────────────────────
            if (categorySlug == null || categorySlug.isBlank()) {
                categorySlug = fallbackCategory;
                recoveredCategory++;
                warnings.add("Category assigned to '" + fallbackCategory + "' for sourceId=" + mp.sourceId());
            }

            MappedProduct normalized = new MappedProduct(
                    mp.sourceId(), slug, mp.name(), mp.description(), mp.sku(),
                    mp.price(), mp.regularPrice(), mp.salePrice(),
                    mp.stockQuantity(), mp.stockStatus(), mp.thumbnailId(),
                    mp.galleryIds(), mp.status(), mp.unmappedFields(), warnings);

            result.add(new ResolvedProduct(normalized, categorySlug, rp.brandSlug()));
        }

        if (recoveredSlug > 0 || recoveredCategory > 0) {
            log.info("ProductNormalization: recoveredSlug={} recoveredCategory={} totalProducts={}",
                    recoveredSlug, recoveredCategory, products.size());
        }

        return new NormalizationResult(result, recoveredSlug, recoveredCategory);
    }
}
