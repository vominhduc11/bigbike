package com.bigbike.bigbike_backend.repository.catalog;

import com.bigbike.bigbike_backend.domain.catalog.Brand;
import com.bigbike.bigbike_backend.domain.catalog.BrandSummary;
import com.bigbike.bigbike_backend.domain.catalog.Category;
import com.bigbike.bigbike_backend.domain.catalog.CategorySummary;
import com.bigbike.bigbike_backend.domain.catalog.GalleryMedia;
import com.bigbike.bigbike_backend.domain.catalog.ImageAsset;
import com.bigbike.bigbike_backend.domain.catalog.Product;
import com.bigbike.bigbike_backend.domain.catalog.ProductCommitment;
import com.bigbike.bigbike_backend.domain.catalog.TrustBadge;
import com.bigbike.bigbike_backend.domain.catalog.ProductFaq;
import com.bigbike.bigbike_backend.domain.catalog.ProductHighlight;
import com.bigbike.bigbike_backend.domain.catalog.ProductPrice;
import com.bigbike.bigbike_backend.domain.catalog.ProductSpecification;
import com.bigbike.bigbike_backend.domain.catalog.ProductSpecStat;
import com.bigbike.bigbike_backend.domain.catalog.ProductVariant;
import com.bigbike.bigbike_backend.domain.catalog.ProductVariantOption;
import com.bigbike.bigbike_backend.domain.catalog.VideoAsset;
import com.bigbike.bigbike_backend.persistence.entity.catalog.BrandEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.CategoryEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductGalleryImageEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductHighlightEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantGalleryImageEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductSpecificationEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductSpecStatEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductCommitmentEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductTrustBadgeEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductFaqEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantOptionEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVideoEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.AttributeEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.AttributeValueEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.AttributeJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.AttributeValueJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.BrandJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.CategoryJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Primary;
import org.springframework.context.annotation.Profile;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import static com.bigbike.bigbike_backend.repository.catalog.JpaCatalogReadSupport.isPresent;
import static com.bigbike.bigbike_backend.repository.catalog.JpaCatalogReadSupport.normalizeVariantToken;
import static com.bigbike.bigbike_backend.repository.catalog.JpaCatalogReadSupport.pick;
import static com.bigbike.bigbike_backend.repository.catalog.JpaCatalogReadSupport.pickBlocks;
import static com.bigbike.bigbike_backend.repository.catalog.JpaCatalogReadSupport.resolveTabs;
import static com.bigbike.bigbike_backend.repository.catalog.JpaCatalogReadSupport.toBrandTranslations;
import static com.bigbike.bigbike_backend.repository.catalog.JpaCatalogReadSupport.toCategoryTranslations;
import static com.bigbike.bigbike_backend.repository.catalog.JpaCatalogReadSupport.toImageAsset;
import static com.bigbike.bigbike_backend.repository.catalog.JpaCatalogReadSupport.toSeoMeta;
import static com.bigbike.bigbike_backend.repository.catalog.JpaCatalogReadSupport.toTranslations;
import static com.bigbike.bigbike_backend.repository.catalog.JpaCatalogReadSupport.preferLabel;
import static com.bigbike.bigbike_backend.repository.catalog.JpaCatalogReadSupport.withColorScopedVariantMedia;

@Repository
@Primary
@Profile("!mock")
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class JpaCatalogReadRepository implements CatalogReadRepository {

    private static final Comparator<ProductHighlightEntity> HIGHLIGHT_ORDER = Comparator.comparingInt(ProductHighlightEntity::getSortOrder);
    private static final Comparator<ProductGalleryImageEntity> GALLERY_ORDER = Comparator.comparingInt(ProductGalleryImageEntity::getSortOrder);
    private static final Comparator<ProductVariantGalleryImageEntity> VARIANT_GALLERY_ORDER = Comparator.comparingInt(ProductVariantGalleryImageEntity::getSortOrder);
    private static final Comparator<ProductVideoEntity> VIDEO_ORDER = Comparator.comparingInt(ProductVideoEntity::getSortOrder);
    private static final Comparator<ProductSpecificationEntity> SPEC_ORDER = Comparator.comparingInt(ProductSpecificationEntity::getSortOrder);
    private static final Comparator<ProductFaqEntity> FAQ_ORDER = Comparator.comparingInt(ProductFaqEntity::getSortOrder);
    private static final Comparator<ProductCommitmentEntity> COMMITMENT_ORDER = Comparator.comparingInt(ProductCommitmentEntity::getSortOrder);
    private static final Comparator<ProductSpecStatEntity> SPEC_STAT_ORDER = Comparator.comparingInt(ProductSpecStatEntity::getSortOrder);
    private static final Comparator<ProductTrustBadgeEntity> TRUST_BADGE_ORDER = Comparator.comparingInt(ProductTrustBadgeEntity::getSortOrder);
    private static final Comparator<ProductVariantEntity> VARIANT_ORDER = Comparator.comparingInt(ProductVariantEntity::getSortOrder);
    private static final Comparator<ProductVariantOptionEntity> VARIANT_OPTION_ORDER = Comparator.comparingInt(ProductVariantOptionEntity::getSortOrder);

    private static final String LOCALE_VI = "vi";
    private static final String LOCALE_EN = "en";

    private final ProductJpaRepository productJpaRepository;
    private final CategoryJpaRepository categoryJpaRepository;
    private final BrandJpaRepository brandJpaRepository;
    private final AttributeJpaRepository attributeJpaRepository;
    private final AttributeValueJpaRepository attributeValueJpaRepository;

    @Override
    public List<Product> findAllProducts() {
        return productJpaRepository.findAll().stream()
                .map(entity -> toDomainPublicView(entity, LOCALE_VI))
                .toList();
    }

    @Override
    public List<Product> findAllPublishedProducts(String locale) {
        return productJpaRepository.findByPublishStatus(PublishStatus.PUBLISHED).stream()
                .map(entity -> toDomainPublicView(entity, locale))
                .toList();
    }

    @Override
    public List<Product> searchPublishedProducts(java.util.List<String> tokens, String locale, int limit) {
        Specification<ProductEntity> spec = (root, query, cb) -> {
            java.util.List<Predicate> preds = new ArrayList<>();
            preds.add(cb.equal(root.get("publishStatus"), PublishStatus.PUBLISHED));
            for (String token : tokens) {
                String like = "%" + token.toLowerCase(Locale.ROOT) + "%";
                preds.add(cb.or(
                        cb.like(cb.lower(root.get("name")), like),
                        cb.like(cb.lower(cb.coalesce(root.get("shortDescription"), "")), like)));
            }
            // Sort by name length ASC (shorter = more exact match), then alphabetically.
            // Guard against count query (Long) which does not support orderBy.
            if (!Long.class.equals(query.getResultType())) {
                query.orderBy(
                        cb.asc(cb.length(root.<String>get("name"))),
                        cb.asc(root.get("name")));
            }
            return cb.and(preds.toArray(new Predicate[0]));
        };
        return productJpaRepository
                .findAll(spec, org.springframework.data.domain.PageRequest.of(0, limit))
                .getContent()
                .stream()
                .map(entity -> toDomainPublicView(entity, locale))
                .toList();
    }

    @Override
    public List<Product> findProductsFiltered(String query, String publishStatus, String stockState, String brandId, String categoryId, String locale) {
        Specification<ProductEntity> spec = buildProductSpec(query, publishStatus, stockState, brandId, categoryId, locale);
        return productJpaRepository.findAll(spec).stream()
                .map(entity -> toDomainListItem(entity, locale))
                .toList();
    }

    private Product toDomainListItem(ProductEntity entity, String locale) {
        CategorySummary primaryCategory = toCategorySummary(entity.getCategory());
        List<CategorySummary> categories = primaryCategory == null
                ? List.of()
                : List.of(primaryCategory);
        return new Product(
                entity.getId(),
                entity.getSku(),
                entity.getSlug(),
                entity.getSlugEn(),
                pick(entity.getName(), entity.getNameEn(), locale),
                null,
                null,
                toBrandSummary(entity.getBrand()),
                primaryCategory,
                categories,
                toImageAsset(
                        entity.getImageId(),
                        entity.getImageUrl(),
                        entity.getImageAlt(),
                        entity.getImageWidth(),
                        entity.getImageHeight(),
                        entity.getImageMimeType()
                ),
                List.of(),
                List.of(),
                new ProductPrice(
                        entity.getRetailPrice(),
                        entity.getCompareAtPrice(),
                        entity.getSalePrice(),
                        entity.getCurrency(),
                        null // list-card view: cost not needed
                ),
                List.of(),
                List.of(),
                entity.getStockState(),
                null, // stockQuantity never exposed — boolean availability model (2026-06-23)
                entity.getForceOutOfStock(),
                entity.getPublishStatus(),
                entity.getHomepageBlock(),
                entity.getHomepageOrder(),
                entity.getRating(),
                entity.getRatingCount(),
                null,                       // promotionContent — detail only
                null,                       // installationGuide — detail only
                List.of(),                  // faqs — detail only
                List.of(),                  // commitments — detail only
                List.of(),                  // specStats — detail only
                List.of(),                  // trustBadges — detail only
                List.of(),                  // positiveNotes — detail only
                List.of(),                  // negativeNotes — detail only
                null,                       // originBrandCountry — detail only
                null,                       // sizeGuide — detail only
                null,                       // suitabilityAdvisory — detail only
                null,                       // specificationsHtml — detail only
                null,                       // specStatsHtml — detail only
                null,                       // trustBadgesHtml — detail only
                entity.getGender(),
                List.of(),                  // relatedProducts — detail only
                List.of(),                  // accessoryProducts — detail only
                null,                       // descriptionBlocks — detail only
                null,                       // tabs — detail only
                null,                       // sectionVisibility — detail only
                null,                       // seo — detail only
                null,                       // translations — detail only (admin detail read)
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }

    private static Specification<ProductEntity> buildProductSpec(String query, String publishStatus, String stockState, String brandId, String categoryId, String locale) {
        return (root, criteriaQuery, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (publishStatus == null || publishStatus.isBlank() || "ALL".equalsIgnoreCase(publishStatus)) {
                predicates.add(cb.notEqual(root.get("publishStatus"), PublishStatus.TRASH));
            } else if ("ALL_INCLUDING_TRASH".equalsIgnoreCase(publishStatus)) {
                // Do not filter by publishStatus at all (includes TRASH)
            } else {
                predicates.add(cb.equal(root.get("publishStatus"), PublishStatus.valueOf(publishStatus)));
            }
            if (stockState != null && !stockState.isBlank()) {
                predicates.add(cb.equal(root.get("stockState"), ProductStockState.valueOf(stockState)));
            }
            if (query != null && !query.isBlank()) {
                String term = "%" + query.toLowerCase(Locale.ROOT) + "%";
                Predicate nameLike = cb.like(cb.lower(root.get("name")), term);
                Predicate slugLike = cb.like(cb.lower(root.get("slug")), term);
                Predicate skuLike = cb.like(cb.lower(cb.coalesce(root.get("sku"), "")), term);
                predicates.add(cb.or(nameLike, slugLike, skuLike));
            }
            if (brandId != null && !brandId.isBlank()) {
                predicates.add(cb.equal(root.join("brand", JoinType.LEFT).get("id"), brandId));
            }
            if (categoryId != null && !categoryId.isBlank()) {
                predicates.add(cb.equal(root.get("category").get("id"), categoryId));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    @Override
    public Optional<Product> findProductBySlug(String slug, String locale) {
        // Resolve by the vi slug first, then the optional English slug — both URLs
        // open the same product. vi-first keeps it deterministic (PRODUCT_RULE_003).
        return productJpaRepository.findBySlug(slug)
                .or(() -> productJpaRepository.findBySlugEn(slug))
                .map(entity -> toDomainPublicView(entity, locale));
    }

    @Override
    public Optional<Product> findProductById(String id) {
        return productJpaRepository.findById(id).map(this::toDomain);
    }

    @Override
    public Optional<Product> findProductByIdPublicView(String id, String locale) {
        return productJpaRepository.findById(id).map(entity -> toDomainPublicView(entity, locale));
    }

    @Override
    public List<Product> findProductsByIdsPublicView(List<String> ids, String locale) {
        if (ids == null || ids.isEmpty()) {
            return List.of();
        }
        return productJpaRepository.findAllById(ids).stream()
                .map(entity -> toDomainPublicView(entity, locale))
                .toList();
    }

    @Override
    public List<Category> findAllCategories() {
        return categoryJpaRepository.findAll().stream().map(this::toDomain).toList();
    }

    @Override
    public List<Category> findAllCategories(String locale) {
        return categoryJpaRepository.findAll().stream()
                .map(entity -> toDomain(entity, locale))
                .toList();
    }

    @Override
    public List<Category> findAllCategories(String locale, boolean strictEnglish) {
        return categoryJpaRepository.findAll().stream()
                .map(entity -> toDomain(entity, locale))
                .toList();
    }

    @Override
    public CategoryPage findCategoriesPaged(
            String query,
            String visibility,
            String sortField,
            boolean sortAsc,
            int page,
            int pageSize,
            String locale
    ) {
        Specification<CategoryEntity> spec = (root, cq, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (visibility != null && !visibility.isBlank()) {
                if ("VISIBLE".equals(visibility)) {
                    predicates.add(cb.isTrue(root.get("isVisible")));
                } else if ("HIDDEN".equals(visibility)) {
                    predicates.add(cb.isFalse(root.get("isVisible")));
                }
            }
            if (query != null && !query.isBlank()) {
                String like = "%" + query.toLowerCase(Locale.ROOT) + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("name")), like),
                        cb.like(cb.lower(root.get("slug")), like)
                ));
            }
            return predicates.isEmpty() ? cb.conjunction() : cb.and(predicates.toArray(new Predicate[0]));
        };

        // Map domain sort field → entity property. sortOrder may be null in DB,
        // so push that to the end regardless of direction (matches old in-memory
        // behaviour where null became Integer.MAX_VALUE).
        String entityField = switch (sortField) {
            case "name" -> "name";
            case "createdAt" -> "createdAt";
            case "updatedAt" -> "updatedAt";
            case "sortOrder" -> "sortOrder";
            default -> "updatedAt";
        };
        org.springframework.data.domain.Sort.Direction dir = sortAsc
                ? org.springframework.data.domain.Sort.Direction.ASC
                : org.springframework.data.domain.Sort.Direction.DESC;
        org.springframework.data.domain.Sort sort = "sortOrder".equals(entityField)
                ? org.springframework.data.domain.Sort.by(
                        new org.springframework.data.domain.Sort.Order(dir, entityField).nullsLast())
                : org.springframework.data.domain.Sort.by(dir, entityField);

        org.springframework.data.domain.PageRequest pageRequest =
                org.springframework.data.domain.PageRequest.of(Math.max(0, page - 1), Math.max(1, pageSize), sort);

        org.springframework.data.domain.Page<CategoryEntity> result =
                categoryJpaRepository.findAll(spec, pageRequest);

        List<Category> items = result.getContent().stream().map(e -> toDomain(e, locale)).toList();
        return new CategoryPage(items, result.getTotalElements());
    }

    @Override
    public Optional<Category> findCategoryBySlug(String slug) {
        return categoryJpaRepository.findBySlug(slug).map(this::toDomain);
    }

    @Override
    public Optional<Category> findCategoryBySlug(String slug, String locale) {
        // vi slug first, then optional English slug (CATEGORY_RULE_003).
        return categoryJpaRepository.findBySlug(slug)
                .or(() -> categoryJpaRepository.findBySlugEn(slug))
                .map(entity -> toDomain(entity, locale));
    }

    @Override
    public Optional<Category> findCategoryById(String id) {
        return categoryJpaRepository.findById(id).map(this::toDomain);
    }

    @Override
    public List<Brand> findAllBrands() {
        return brandJpaRepository.findAll().stream().map(this::toDomain).toList();
    }

    @Override
    public List<Brand> findAllBrands(String locale) {
        return brandJpaRepository.findAll().stream()
                .map(entity -> toDomain(entity, locale))
                .toList();
    }

    @Override
    public List<Brand> findAllBrands(String locale, boolean strictEnglish) {
        return brandJpaRepository.findAll().stream()
                .map(entity -> toDomain(entity, locale))
                .toList();
    }

    @Override
    public Optional<Brand> findBrandBySlug(String slug) {
        return brandJpaRepository.findBySlug(slug).map(this::toDomain);
    }

    @Override
    public Optional<Brand> findBrandBySlug(String slug, String locale) {
        // vi slug first, then optional English slug (BRAND_RULE_003).
        return brandJpaRepository.findBySlug(slug)
                .or(() -> brandJpaRepository.findBySlugEn(slug))
                .map(entity -> toDomain(entity, locale));
    }

    @Override
    public Optional<Brand> findBrandById(String id) {
        return brandJpaRepository.findById(id).map(this::toDomain);
    }

    private Product toDomainPublicView(ProductEntity entity, String locale) {
        return toDomain(entity, true, locale);
    }

    /**
     * Map an in-memory (transient, unsaved) product entity to the public-facing
     * {@link Product} domain — used by the admin live-preview dry-run so the
     * storefront template can render draft input without persisting anything.
     * {@code publicView=true} mirrors exactly what the storefront PDP shows
     * (cost price hidden, stock quantity masked).
     */
    public Product mapPreviewProduct(ProductEntity entity, String locale) {
        return toDomain(entity, true, locale);
    }

    /**
     * Admin detail read: main fields stay Vietnamese (canonical); the raw English
     * content is carried separately in {@code translations} / the {@code *En}
     * spec/FAQ fields so the editor can show both languages.
     */
    private Product toDomain(ProductEntity entity) {
        return toDomain(entity, false, LOCALE_VI);
    }

    private Product toDomain(ProductEntity entity, boolean publicView, String locale) {
        CategorySummary primaryCategory = toCategorySummary(entity.getCategory());
        List<CategorySummary> categories = primaryCategory == null
                ? List.of()
                : List.of(primaryCategory);

        // Public never sees a count — boolean availability model (owner decision 2026-06-23).
        Integer productStockQty = publicView ? null : entity.getStockQuantity();

        return new Product(
                entity.getId(),
                entity.getSku(),
                entity.getSlug(),
                entity.getSlugEn(),
                pick(entity.getName(), entity.getNameEn(), locale),
                pick(entity.getShortDescription(), entity.getShortDescriptionEn(), locale),
                pick(entity.getDescription(), entity.getDescriptionEn(), locale),
                toBrandSummary(entity.getBrand(), publicView),
                primaryCategory,
                categories,
                toImageAsset(
                        entity.getImageId(),
                        entity.getImageUrl(),
                        entity.getImageAlt(),
                        entity.getImageWidth(),
                        entity.getImageHeight(),
                        entity.getImageMimeType()
                ),
                toGallery(entity),
                toVideos(entity),
                new ProductPrice(
                        entity.getRetailPrice(),
                        entity.getCompareAtPrice(),
                        entity.getSalePrice(),
                        entity.getCurrency(),
                        publicView ? null : entity.getCostPrice() // admin-only
                ),
                toVariants(entity, publicView, locale),
                toSpecifications(entity, publicView, locale),
                entity.getStockState(),
                productStockQty,
                entity.getForceOutOfStock(),
                entity.getPublishStatus(),
                entity.getHomepageBlock(),
                entity.getHomepageOrder(),
                entity.getRating(),
                entity.getRatingCount(),
                pick(entity.getPromotionContent(), entity.getPromotionContentEn(), locale),
                pick(entity.getInstallationGuide(), entity.getInstallationGuideEn(), locale),
                toFaqs(entity, publicView, locale),
                toCommitments(entity, publicView, locale),
                toSpecStats(entity, publicView, locale),
                toTrustBadges(entity, publicView, locale),
                toHighlights(entity, ProductHighlightEntity.KIND_PRO, publicView, locale),
                toHighlights(entity, ProductHighlightEntity.KIND_CON, publicView, locale),
                entity.getOriginBrandCountry(),
                entity.getSizeGuide(),
                pick(entity.getSuitabilityAdvisory(), entity.getSuitabilityAdvisoryEn(), locale),
                pick(entity.getSpecificationsHtml(), entity.getSpecificationsHtmlEn(), locale),
                pick(entity.getSpecStatsHtml(), entity.getSpecStatsHtmlEn(), locale),
                pick(entity.getTrustBadgesHtml(), entity.getTrustBadgesHtmlEn(), locale),
                entity.getGender(),
                toRelatedProducts(entity, publicView, locale),
                toAccessoryProducts(entity, publicView, locale),
                pickBlocks(entity.getDescriptionBlocks(), entity.getDescriptionBlocksEn(), locale),
                resolveTabs(entity, publicView, locale),
                entity.getSectionVisibility(),
                toSeoMeta(
                        pick(entity.getSeoTitle(), entity.getSeoTitleEn(), locale),
                        pick(entity.getSeoDescription(), entity.getSeoDescriptionEn(), locale),
                        entity.getSeoCanonicalUrl(),
                        entity.getSeoOgImageId(),
                        entity.getSeoOgImageUrl(),
                        entity.getSeoOgImageAlt(),
                        entity.getSeoOgImageWidth(),
                        entity.getSeoOgImageHeight(),
                        entity.getSeoOgImageMimeType()
                ),
                publicView ? null : toTranslations(entity),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }

    /** Admin detail read: Vietnamese content + raw English translations. */
    private Category toDomain(CategoryEntity entity) {
        return toDomain(entity, LOCALE_VI, true);
    }

    /** Public read: localized content, no translations object. */
    private Category toDomain(CategoryEntity entity, String locale) {
        return toDomain(entity, locale, false);
    }

    private Category toDomain(CategoryEntity entity, String locale, boolean includeTranslations) {
        return new Category(
                entity.getId(),
                entity.getSlug(),
                entity.getSlugEn(),
                pick(entity.getName(), entity.getNameEn(), locale),
                pick(entity.getDescription(), entity.getDescriptionEn(), locale),
                entity.getParentId(),
                toImageAsset(
                        entity.getImageId(),
                        entity.getImageUrl(),
                        entity.getImageAlt(),
                        entity.getImageWidth(),
                        entity.getImageHeight(),
                        entity.getImageMimeType()
                ),
                toImageAsset(
                        entity.getIconId(),
                        entity.getIconUrl(),
                        entity.getIconAlt(),
                        entity.getIconWidth(),
                        entity.getIconHeight(),
                        entity.getIconMimeType()
                ),
                entity.getMenuIconUrl(),
                toImageAsset(null, entity.getBannerUrl(), entity.getBannerAlt(), null, null, null),
                toImageAsset(null, entity.getMobileBannerUrl(), entity.getMobileBannerAlt(), null, null, null),
                toSeoMeta(
                        pick(entity.getSeoTitle(), entity.getSeoTitleEn(), locale),
                        pick(entity.getSeoDescription(), entity.getSeoDescriptionEn(), locale),
                        entity.getSeoCanonicalUrl(),
                        entity.getSeoOgImageId(),
                        entity.getSeoOgImageUrl(),
                        entity.getSeoOgImageAlt(),
                        entity.getSeoOgImageWidth(),
                        entity.getSeoOgImageHeight(),
                        entity.getSeoOgImageMimeType()
                ),
                entity.isVisible(),
                entity.getShowOnHomepage(),
                entity.getSortOrder(),
                pick(entity.getContentBottom(), entity.getContentBottomEn(), locale),
                includeTranslations ? toCategoryTranslations(entity) : null,
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }

    /** Admin detail read: Vietnamese content + raw English translations. */
    private Brand toDomain(BrandEntity entity) {
        return toDomain(entity, LOCALE_VI, true);
    }

    /** Public read: localized content, no translations object. */
    private Brand toDomain(BrandEntity entity, String locale) {
        return toDomain(entity, locale, false);
    }

    private Brand toDomain(BrandEntity entity, String locale, boolean includeTranslations) {
        return new Brand(
                entity.getId(),
                entity.getSlug(),
                entity.getSlugEn(),
                pick(entity.getName(), entity.getNameEn(), locale),
                pick(entity.getDescription(), entity.getDescriptionEn(), locale),
                toImageAsset(
                        entity.getLogoId(),
                        entity.getLogoUrl(),
                        entity.getLogoAlt(),
                        entity.getLogoWidth(),
                        entity.getLogoHeight(),
                        entity.getLogoMimeType()
                ),
                toImageAsset(null, entity.getBannerUrl(), entity.getBannerAlt(), null, null, null),
                toImageAsset(null, entity.getMobileBannerUrl(), entity.getMobileBannerAlt(), null, null, null),
                toSeoMeta(
                        pick(entity.getSeoTitle(), entity.getSeoTitleEn(), locale),
                        pick(entity.getSeoDescription(), entity.getSeoDescriptionEn(), locale),
                        entity.getSeoCanonicalUrl(),
                        entity.getSeoOgImageId(),
                        entity.getSeoOgImageUrl(),
                        entity.getSeoOgImageAlt(),
                        entity.getSeoOgImageWidth(),
                        entity.getSeoOgImageHeight(),
                        entity.getSeoOgImageMimeType()
                ),
                entity.isVisible(),
                includeTranslations ? toBrandTranslations(entity) : null,
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }

    private List<GalleryMedia> toGallery(ProductEntity entity) {
        if (entity.getGallery() == null) {
            return List.of();
        }
        return entity.getGallery().stream()
                .sorted(GALLERY_ORDER)
                .map(item -> toGalleryMedia(
                        item.getMediaType(), item.getVideoUrl(), item.getVideoProvider(),
                        item.getImageId(), item.getImageUrl(), item.getImageAlt(),
                        item.getImageWidth(), item.getImageHeight(), item.getImageMimeType()
                ))
                .filter(m -> m != null)
                .toList();
    }

    /** Map một dòng gallery (ảnh/video) → {@link GalleryMedia}. Null khi thiếu nội dung (ảnh rỗng / video thiếu url). */
    private GalleryMedia toGalleryMedia(
            String mediaType, String videoUrl, String videoProvider,
            String imageId, String imageUrl, String imageAlt, Integer width, Integer height, String mimeType) {
        ImageAsset image = toImageAsset(imageId, imageUrl, imageAlt, width, height, mimeType);
        if ("video".equals(mediaType)) {
            if (videoUrl == null || videoUrl.isBlank()) {
                return null;
            }
            return GalleryMedia.ofVideo(image, videoUrl, videoProvider);
        }
        if (image == null) {
            return null;
        }
        return GalleryMedia.ofImage(image);
    }

    private List<VideoAsset> toVideos(ProductEntity entity) {
        if (entity.getVideos() == null) {
            return List.of();
        }
        return entity.getVideos().stream()
                .sorted(VIDEO_ORDER)
                .map(item -> new VideoAsset(
                        item.getVideoId(),
                        item.getVideoUrl(),
                        item.getTitle(),
                        toImageAsset(
                                item.getThumbnailId(),
                                item.getThumbnailUrl(),
                                item.getThumbnailAlt(),
                                item.getThumbnailWidth(),
                                item.getThumbnailHeight(),
                                item.getThumbnailMimeType()
                        ),
                        item.getProvider(),
                        item.getDescription()
                ))
                .toList();
    }

    /**
     * Ưu/Nhược điểm (V175) đã resolve theo locale, lọc theo {@code kind} (PRO/CON). Nguồn dữ liệu là
     * bảng con {@code product_highlights} — khối đứng RIÊNG dưới mô tả, ngoài tab (ưu/nhược điểm tách
     * khỏi mô tả). Trả mảng cho schema.org positiveNotes/negativeNotes; {@code contentEn} (admin only).
     */
    private List<ProductHighlight> toHighlights(ProductEntity entity, String kind, boolean publicView, String locale) {
        if (entity.getHighlights() == null) {
            return List.of();
        }
        return entity.getHighlights().stream()
                .filter(item -> kind.equals(item.getKind()))
                .sorted(HIGHLIGHT_ORDER)
                .map(item -> new ProductHighlight(
                        pick(item.getContent(), item.getContentEn(), locale),
                        publicView ? null : item.getContentEn()
                ))
                .toList();
    }

    /**
     * Resolved spec content for the requested locale. On admin reads
     * ({@code publicView == false}) the raw English values ride along in the
     * {@code *En} fields so the editor can show both languages.
     */
    private List<ProductSpecification> toSpecifications(ProductEntity entity, boolean publicView, String locale) {
        if (entity.getSpecifications() == null) {
            return List.of();
        }
        return entity.getSpecifications().stream()
                .sorted(SPEC_ORDER)
                .map(item -> new ProductSpecification(
                        pick(item.getName(), item.getNameEn(), locale),
                        pick(item.getValue(), item.getValueEn(), locale),
                        pick(item.getGroupName(), item.getGroupNameEn(), locale),
                        publicView ? null : item.getNameEn(),
                        publicView ? null : item.getValueEn(),
                        publicView ? null : item.getGroupNameEn()
                ))
                .toList();
    }

    /**
     * "Specs Dashboard" stat boxes (V235) resolved for the requested locale. On admin
     * reads the raw English values ride along in the {@code *En} fields.
     */
    private List<ProductSpecStat> toSpecStats(ProductEntity entity, boolean publicView, String locale) {
        if (entity.getSpecStats() == null) {
            return List.of();
        }
        return entity.getSpecStats().stream()
                .sorted(SPEC_STAT_ORDER)
                .map(item -> new ProductSpecStat(
                        pick(item.getValue(), item.getValueEn(), locale),
                        pick(item.getLabel(), item.getLabelEn(), locale),
                        publicView ? null : item.getValueEn(),
                        publicView ? null : item.getLabelEn()
                ))
                .toList();
    }

    private List<ProductFaq> toFaqs(ProductEntity entity, boolean publicView, String locale) {
        if (entity.getFaqs() == null) {
            return List.of();
        }
        return entity.getFaqs().stream()
                .sorted(FAQ_ORDER)
                .map(item -> new ProductFaq(
                        pick(item.getQuestion(), item.getQuestionEn(), locale),
                        pick(item.getAnswer(), item.getAnswerEn(), locale),
                        publicView ? null : item.getQuestionEn(),
                        publicView ? null : item.getAnswerEn()
                ))
                .toList();
    }

    /**
     * Per-product commitment rows (V232) resolved for the requested locale. On
     * admin reads the raw English values ride along in the {@code *En} fields.
     */
    private List<ProductCommitment> toCommitments(ProductEntity entity, boolean publicView, String locale) {
        if (entity.getCommitments() == null) {
            return List.of();
        }
        return entity.getCommitments().stream()
                .sorted(COMMITMENT_ORDER)
                .map(item -> new ProductCommitment(
                        item.getIcon(),
                        pick(item.getTitle(), item.getTitleEn(), locale),
                        pick(item.getSubtitle(), item.getSubtitleEn(), locale),
                        publicView ? null : item.getTitleEn(),
                        publicView ? null : item.getSubtitleEn()
                ))
                .toList();
    }


    /**
     * Per-product trust badges (V233) resolved for the requested locale. On admin
     * reads the raw English value rides along in {@code contentEn}; public reads null it.
     */
    private List<TrustBadge> toTrustBadges(ProductEntity entity, boolean publicView, String locale) {
        if (entity.getTrustBadges() == null) {
            return List.of();
        }
        return entity.getTrustBadges().stream()
                .sorted(TRUST_BADGE_ORDER)
                .map(item -> new TrustBadge(
                        pick(item.getContent(), item.getContentEn(), locale),
                        publicView ? null : item.getContentEn()
                ))
                .toList();
    }

    /**
     * Admin-curated related products as list-view items (no nested gallery/specs/
     * relatedProducts). Public reads drop non-PUBLISHED and trashed entries so the
     * PDP never links to hidden products; admin reads keep everything for the editor.
     */
    private List<Product> toRelatedProducts(ProductEntity entity, boolean publicView, String locale) {
        if (entity.getRelatedProducts() == null || entity.getRelatedProducts().isEmpty()) {
            return List.of();
        }
        return entity.getRelatedProducts().stream()
                .filter(rp -> !publicView || rp.getPublishStatus() == PublishStatus.PUBLISHED)
                .map(rp -> toDomainListItem(rp, locale))
                .toList();
    }

    /**
     * Admin-curated accessory products ("Phụ kiện" — sản phẩm bán kèm) as list-view
     * items. Public reads drop non-PUBLISHED entries so the PDP never links to hidden
     * products; admin reads keep everything for the editor. Mirrors {@link #toRelatedProducts}.
     */
    private List<Product> toAccessoryProducts(ProductEntity entity, boolean publicView, String locale) {
        if (entity.getAccessoryProducts() == null || entity.getAccessoryProducts().isEmpty()) {
            return List.of();
        }
        return entity.getAccessoryProducts().stream()
                .filter(ap -> !publicView || ap.getPublishStatus() == PublishStatus.PUBLISHED)
                .map(ap -> toDomainListItem(ap, locale))
                .toList();
    }

    private List<ProductVariant> toVariants(ProductEntity entity, boolean publicView, String locale) {
        if (entity.getVariants() == null) {
            return List.of();
        }
        List<ProductVariant> variants = entity.getVariants().stream()
                .sorted(VARIANT_ORDER)
                .map(v -> toVariant(v, publicView, locale))
                .toList();
        return withColorScopedVariantMedia(variants);
    }

    private ProductVariant toVariant(ProductVariantEntity entity, boolean publicView, String locale) {
        ProductPrice price = entity.getRetailPrice() == null
                ? null
                : new ProductPrice(
                        entity.getRetailPrice(),
                        entity.getCompareAtPrice(),
                        entity.getSalePrice(),
                        entity.getCurrency() == null ? "VND" : entity.getCurrency(),
                        publicView ? null : entity.getCostPrice() // admin-only (variant cost)
                );

        // Prefer the human-readable attribute label over the raw slug so the
        // storefront displays "Đen bóng" / "Màu sắc" rather than "den-bong" /
        // "color". When the option's FK to AttributeValueEntity is null
        // (legacy data, manual admin saves before V42 backfill), fall back
        // to a (code, slug) lookup so colour swatches still render — the
        // dictionary tables hold the per-term hex/image regardless of
        // whether the variant_options FK was populated.
        List<ProductVariantOption> options = entity.getOptions() == null
                ? List.of()
                : entity.getOptions().stream()
                        .sorted(VARIANT_OPTION_ORDER)
                        .map(option -> toVariantOption(option, publicView, locale))
                        .toList();

        List<GalleryMedia> gallery = entity.getGallery() == null
                ? List.of()
                : entity.getGallery().stream()
                        .sorted(VARIANT_GALLERY_ORDER)
                        .map(item -> toGalleryMedia(
                                item.getMediaType(), item.getVideoUrl(), item.getVideoProvider(),
                                item.getImageId(), item.getImageUrl(), item.getImageAlt(),
                                item.getImageWidth(), item.getImageHeight(), item.getImageMimeType()
                        ))
                        .filter(m -> m != null)
                        .toList();

        // Public never sees a count — boolean availability model (owner decision 2026-06-23).
        Integer variantStockQty = publicView ? null : entity.getQuantityOnHand();

        return new ProductVariant(
                entity.getId(),
                entity.getSku(),
                entity.getName(),
                options,
                price,
                entity.getStockState(),
                variantStockQty,
                toImageAsset(
                        entity.getImageId(),
                        entity.getImageUrl(),
                        entity.getImageAlt(),
                        entity.getImageWidth(),
                        entity.getImageHeight(),
                        entity.getImageMimeType()
                ),
                gallery,
                entity.isAvailable()
        );
    }

    /**
     * Build a {@link ProductVariantOption} from one stored option row,
     * resolving the AttributeValue dictionary lazily when the FK is null so the
     * read path can return the human label ("Đen bóng") rather than the raw
     * slug. Colour variants render on the storefront from the variant's own
     * gallery image (see {@code VariantSelector.tsx}), so no per-term swatch or
     * hex value is surfaced here.
     */
    private ProductVariantOption toVariantOption(ProductVariantOptionEntity option, boolean publicView, String locale) {
        AttributeEntity attribute = option.getAttribute();
        AttributeValueEntity value = option.getAttributeValue();

        // Lazy resolution path: only fires when the FK wasn't populated at write time.
        // Three fallbacks mirror AdminCatalogMutationService.linkAttributeReferences():
        //   1. findByCode  — exact WP taxonomy slug (e.g. "pa_color")
        //   2. findByNameIgnoreCase — human-typed label (e.g. "Màu sắc")
        //   3. slug normalisation  — strips diacritics so "Đen" matches stored slug "den"
        if (attribute == null && option.getOptionName() != null && !option.getOptionName().isBlank()) {
            attribute = attributeJpaRepository.findByCode(option.getOptionName()).orElse(null);
            if (attribute == null) {
                attribute = attributeJpaRepository.findByNameIgnoreCase(option.getOptionName()).orElse(null);
            }
        }
        if (value == null && attribute != null
                && option.getOptionValue() != null && !option.getOptionValue().isBlank()) {
            value = attributeValueJpaRepository
                    .findByAttributeIdAndSlug(attribute.getId(), option.getOptionValue())
                    .orElse(null);
            if (value == null) {
                String normalizedSlug = normalizeVariantToken(option.getOptionValue());
                if (!normalizedSlug.isEmpty()) {
                    value = attributeValueJpaRepository
                            .findByAttributeIdAndSlug(attribute.getId(), normalizedSlug)
                            .orElse(null);
                    if (value == null) {
                        // Slugs are hyphenated ("den-bong"); the normalised token is
                        // space-separated ("den bong"). Recover multi-word labels
                        // ("Đen bóng") by trying the hyphenated slug shape.
                        value = attributeValueJpaRepository
                                .findByAttributeIdAndSlug(attribute.getId(), normalizedSlug.replace(' ', '-'))
                                .orElse(null);
                    }
                }
            }
        }

        // Admin-only round-trip reference — the read path returns the human label,
        // so the editor needs the raw dictionary id to re-save without losing the
        // colour link. Omitted from the public response (@JsonInclude NON_NULL).
        String attributeValueId = publicView || value == null ? null : value.getId();

        return new ProductVariantOption(
                preferLabel(
                        attribute != null ? pick(attribute.getName(), attribute.getNameEn(), locale) : null,
                        option.getOptionName()
                ),
                preferLabel(
                        value != null ? pick(value.getLabel(), value.getLabelEn(), locale) : null,
                        option.getOptionValue()
                ),
                attributeValueId
        );
    }

    private CategorySummary toCategorySummary(CategoryEntity entity) {
        if (entity == null) {
            return null;
        }
        return new CategorySummary(entity.getId(), entity.getSlug(), entity.getSlugEn(), entity.getName());
    }

    private BrandSummary toBrandSummary(BrandEntity entity) {
        return toBrandSummary(entity, false);
    }

    private BrandSummary toBrandSummary(BrandEntity entity, boolean publicView) {
        if (entity == null) {
            return null;
        }
        if (publicView && !entity.isVisible()) {
            return null;
        }
        return new BrandSummary(entity.getId(), entity.getSlug(), entity.getSlugEn(), entity.getName());
    }
}
