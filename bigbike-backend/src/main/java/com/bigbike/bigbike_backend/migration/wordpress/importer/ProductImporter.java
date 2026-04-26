package com.bigbike.bigbike_backend.migration.wordpress.importer;

import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressMediaMapper.MappedMedia;
import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressProductMapper.MappedProduct;
import com.bigbike.bigbike_backend.migration.wordpress.writeplan.MigrationDomain;
import com.bigbike.bigbike_backend.persistence.entity.catalog.BrandEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.CategoryEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductGalleryImageEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.BrandJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.CategoryJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
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
     * mediaByLegacyId maps WP attachment ID → MappedMedia for thumbnail resolution.
     */
    @Transactional
    public MigrationExecutionReport.DomainResult importBatch(
            List<ResolvedProduct> items,
            MigrationExecutionOptions options,
            Map<Long, MappedMedia> mediaByLegacyId,
            String mediaPublicBaseUrl) {

        int inserted = 0, updated = 0, skipped = 0, failed = 0;
        List<String> warnings = new ArrayList<>();
        List<String> errors = new ArrayList<>();
        Set<String> seenSkus = new java.util.HashSet<>();

        for (ResolvedProduct rp : items) {
            MappedProduct mp = rp.product();
            try {
                String entityId = "wp-prod-" + mp.sourceId();
                Optional<ProductEntity> existing = productRepo.findById(entityId);
                String slug = existing.map(ProductEntity::getSlug).orElseGet(() -> resolveSlug(mp));
                if (existing.isEmpty()) {
                    slug = ensureUniqueSlug(slug, entityId);
                }
                String name = resolveName(mp, slug);
                ProductEntity entity;
                boolean isNew;
                if (existing.isPresent()) {
                    entity = existing.get();
                    isNew = false;
                } else {
                    entity = new ProductEntity();
                    entity.setId(entityId);
                    entity.setCreatedAt(Instant.now());
                    isNew = true;
                }
                entity.setLegacyId(String.valueOf(mp.sourceId()));
                entity.setSlug(slug);
                entity.setName(name);
                entity.setDescription(mp.description());
                entity.setSeoTitle(mp.seoTitle());
                entity.setSeoDescription(mp.seoDescription());
                entity.setStockQuantity(mp.stockQuantity());
                entity.setManageStock(mp.manageStock());
                entity.setBackorders(mp.backorders());
                entity.setFeatured(Boolean.TRUE.equals(mp.isFeatured()));
                entity.setShowOnHomepage(mp.showOnHomepage());
                entity.setRating(mp.rating());

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

                // Price: MappedProduct.price() is BigDecimal; entity fields are BigDecimal(19,2)
                BigDecimal retailPrice = mp.price() != null
                        ? mp.price()
                        : (mp.regularPrice() != null ? mp.regularPrice() : BigDecimal.ZERO);
                BigDecimal compareAtPrice = mp.regularPrice();
                BigDecimal salePrice = mp.salePrice();
                entity.setRetailPrice(retailPrice);
                entity.setCompareAtPrice(compareAtPrice != null && compareAtPrice.signum() > 0 ? compareAtPrice : null);
                entity.setSalePrice(salePrice != null && salePrice.signum() > 0 ? salePrice : null);
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
                    warnings.add("No category found for product slug=" + slug
                            + "; skipping (category FK is required)");
                    skipped++;
                    continue;
                }
                if (category != null) entity.setCategory(category);
                entity.setCategories(resolveCategories(category, rp.categorySlugs()));

                // Brand link (optional)
                if (rp.brandSlug() != null) {
                    brandRepo.findBySlug(rp.brandSlug()).ifPresent(entity::setBrand);
                }

                // Thumbnail image — resolved from WP _thumbnail_id via mediaByLegacyId map
                if (mp.thumbnailId() != null) {
                    MappedMedia thumb = mediaByLegacyId.get(mp.thumbnailId());
                    if (thumb != null && thumb.storagePath() != null && !thumb.storagePath().isBlank()) {
                        entity.setImageId(String.valueOf(mp.thumbnailId()));
                        entity.setImageUrl(buildMediaUrl(mediaPublicBaseUrl, thumb.storagePath()));
                        entity.setImageAlt(thumb.altText());
                        entity.setImageWidth(thumb.width());
                        entity.setImageHeight(thumb.height());
                        entity.setImageMimeType(thumb.mimeType());
                    }
                }

                // Gallery images — resolved from WP _product_image_gallery (comma-separated media IDs)
                List<ProductGalleryImageEntity> galleryEntities = new ArrayList<>();
                String thumbUrl = entity.getImageUrl();
                if (mp.galleryIds() != null) {
                    int order = 0;
                    for (Long gid : mp.galleryIds()) {
                        MappedMedia gm = mediaByLegacyId.get(gid);
                        if (gm == null || gm.storagePath() == null || gm.storagePath().isBlank()) continue;
                        String url = buildMediaUrl(mediaPublicBaseUrl, gm.storagePath());
                        if (url.equals(thumbUrl)) continue; // skip duplicate of main image
                        ProductGalleryImageEntity gi = new ProductGalleryImageEntity();
                        gi.setProduct(entity);
                        gi.setImageId(String.valueOf(gid));
                        gi.setImageUrl(url);
                        gi.setImageAlt(gm.altText());
                        gi.setImageWidth(gm.width());
                        gi.setImageHeight(gm.height());
                        gi.setImageMimeType(gm.mimeType());
                        gi.setSortOrder(order++);
                        galleryEntities.add(gi);
                    }
                }
                if (entity.getGallery() == null) {
                    entity.setGallery(new ArrayList<>());
                }
                entity.getGallery().clear();
                entity.getGallery().addAll(galleryEntities);

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

    private String ensureUniqueSlug(String slug, String entityId) {
        String normalized = slug == null ? "" : slug.trim();
        if (normalized.isBlank()) {
            normalized = entityId;
        }
        Optional<ProductEntity> slugOwner = productRepo.findBySlug(normalized);
        if (slugOwner.isEmpty() || entityId.equals(slugOwner.get().getId())) {
            return normalized;
        }
        return normalized + "-wp-" + entityId.substring("wp-prod-".length());
    }

    private String resolveSlug(MappedProduct product) {
        if (product.slug() != null && !product.slug().isBlank()) {
            return product.slug();
        }
        return "product-" + product.sourceId();
    }

    private String resolveName(MappedProduct product, String fallbackSlug) {
        if (product.name() != null && !product.name().isBlank()) {
            return product.name();
        }
        if (product.sku() != null && !product.sku().isBlank()) {
            return product.sku();
        }
        return fallbackSlug;
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
            List<String> categorySlugs,
            String brandSlug) {

        public ResolvedProduct(MappedProduct product, String categorySlug, String brandSlug) {
            this(product, categorySlug, categorySlug == null ? List.of() : List.of(categorySlug), brandSlug);
        }

        public ResolvedProduct {
            categorySlugs = categorySlugs == null ? List.of() : List.copyOf(categorySlugs);
        }
    }

    private String buildMediaUrl(String mediaPublicBaseUrl, String storagePath) {
        String base = mediaPublicBaseUrl.endsWith("/")
                ? mediaPublicBaseUrl.substring(0, mediaPublicBaseUrl.length() - 1)
                : mediaPublicBaseUrl;
        String path = storagePath.startsWith("/") ? storagePath.substring(1) : storagePath;
        return base + "/wp-uploads/" + path;
    }

    private Set<CategoryEntity> resolveCategories(CategoryEntity primaryCategory, List<String> categorySlugs) {
        Set<CategoryEntity> categories = new LinkedHashSet<>();
        if (primaryCategory != null) {
            categories.add(primaryCategory);
        }
        if (categorySlugs != null) {
            for (String slug : categorySlugs) {
                String normalized = slug == null ? null : slug.trim();
                if (normalized == null || normalized.isBlank()) {
                    continue;
                }
                categoryRepo.findBySlug(normalized).ifPresent(categories::add);
            }
        }
        return categories;
    }
}
