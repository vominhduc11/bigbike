package com.bigbike.bigbike_backend.repository.catalog;

import com.bigbike.bigbike_backend.domain.catalog.Brand;
import com.bigbike.bigbike_backend.domain.catalog.BrandSummary;
import com.bigbike.bigbike_backend.domain.catalog.Category;
import com.bigbike.bigbike_backend.domain.catalog.CategorySummary;
import com.bigbike.bigbike_backend.domain.catalog.GalleryMedia;
import com.bigbike.bigbike_backend.domain.catalog.SeoIndexPolicy;
import com.bigbike.bigbike_backend.domain.catalog.HomepageBlock;
import com.bigbike.bigbike_backend.domain.catalog.ImageAsset;
import com.bigbike.bigbike_backend.domain.catalog.Product;
import com.bigbike.bigbike_backend.domain.catalog.ProductCommitment;
import com.bigbike.bigbike_backend.domain.catalog.ProductFaq;
import com.bigbike.bigbike_backend.domain.catalog.ProductGenderSupport;
import com.bigbike.bigbike_backend.domain.catalog.ProductHighlight;
import com.bigbike.bigbike_backend.domain.catalog.ProductHighlights;
import com.bigbike.bigbike_backend.domain.catalog.ProductPrice;
import com.bigbike.bigbike_backend.domain.catalog.ProductVariant;
import com.bigbike.bigbike_backend.domain.catalog.ProductVariantOption;
import com.bigbike.bigbike_backend.domain.catalog.VideoAsset;
import com.bigbike.bigbike_backend.persistence.entity.catalog.BrandEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.CategoryEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantGalleryImageEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantOptionEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.AttributeEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.AttributeValueEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.BrandJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.CategoryJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.service.pricing.VariantPricing;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Primary;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.context.annotation.Profile;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import static com.bigbike.bigbike_backend.repository.catalog.JpaCatalogReadSupport.isPresent;
import static com.bigbike.bigbike_backend.repository.catalog.JpaCatalogReadSupport.pick;
import static com.bigbike.bigbike_backend.repository.catalog.JpaCatalogReadSupport.resolveDescriptionBlocksForPublic;
import static com.bigbike.bigbike_backend.repository.catalog.JpaCatalogReadSupport.resolveSizeGuideSectionForPublic;
import static com.bigbike.bigbike_backend.repository.catalog.JpaCatalogReadSupport.resolveSuitabilitySectionForPublic;
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

    private static final Comparator<ProductVariantGalleryImageEntity> VARIANT_GALLERY_ORDER = Comparator.comparingInt(ProductVariantGalleryImageEntity::getSortOrder);
    private static final Comparator<ProductVariantEntity> VARIANT_ORDER = Comparator.comparingInt(ProductVariantEntity::getSortOrder);
    private static final Comparator<ProductVariantOptionEntity> VARIANT_OPTION_ORDER = Comparator.comparingInt(ProductVariantOptionEntity::getSortOrder);

    private static final String LOCALE_VI = "vi";
    private static final String LOCALE_EN = "en";

    private final ProductJpaRepository productJpaRepository;
    private final CategoryJpaRepository categoryJpaRepository;
    private final BrandJpaRepository brandJpaRepository;

    @Override
    public List<Product> findAllProducts() {
        return productJpaRepository.findAll().stream()
                .map(entity -> toDomainPublicView(entity, LOCALE_VI))
                .toList();
    }

    @Override
    public List<Product> findAllPublishedProducts(String locale) {
        return productJpaRepository.findByPublishStatusAndDiscontinuedFalse(PublishStatus.PUBLISHED).stream()
                .map(entity -> toDomainPublicView(entity, locale))
                .toList();
    }

    @Override
    public List<Product> findAllPublishedProductsForListing(String locale) {
        return productJpaRepository.findByPublishStatusAndDiscontinuedFalse(PublishStatus.PUBLISHED).stream()
                .map(entity -> toDomainListing(entity, locale))
                .toList();
    }

    @Override
    public ProductListingPage findPublishedProductsPaged(
            String categorySlug,
            String brandSlug,
            String q,
            List<String> genders,
            String sizeFilter,
            Long minPrice,
            Long maxPrice,
            HomepageBlock homepageBlock,
            com.bigbike.bigbike_backend.service.common.SortSpec sortSpec,
            int page,
            int size,
            String locale
    ) {
        Set<String> categoryIds = resolveCategorySlugWithDescendants(categorySlug);
        Specification<ProductEntity> spec = buildPublicListingSpec(
                categoryIds, brandSlug, q, genders, minPrice, maxPrice, homepageBlock, sortSpec);
        org.springframework.data.domain.PageRequest pageRequest =
                org.springframework.data.domain.PageRequest.of(Math.max(0, page - 1), Math.max(1, size));
        org.springframework.data.domain.Page<ProductEntity> result =
                productJpaRepository.findAll(spec, pageRequest);
        List<Product> items = result.getContent().stream()
                .map(entity -> toDomainListing(entity, locale))
                .toList();
        return new ProductListingPage(items, result.getTotalElements());
    }

    /**
     * Resolves a storefront category slug to self + descendant category ids (CATEGORY_RULE_006).
     * Returns {@code null} when no slug was requested at all (skip the category predicate
     * entirely), or an empty set when a slug was given but didn't resolve to any category (the
     * caller turns that into an always-false predicate so an invalid slug still yields zero
     * results, matching prior behaviour). Deliberately uses the single-arg, VI-slug-only
     * {@code findBySlug} lookup — not the {@code slugEn}-aware overload — to preserve the exact
     * matching scope the raw {@code category.slug = :categorySlug} predicate had before this
     * change.
     */
    private Set<String> resolveCategorySlugWithDescendants(String categorySlug) {
        if (categorySlug == null || categorySlug.isBlank()) {
            return null;
        }
        return categoryJpaRepository.findBySlug(categorySlug)
                .map(entity -> ProductFilterSpecifications.resolveCategoryIds(
                        entity.getId(), categoryJpaRepository.findAll()))
                .orElse(Set.of());
    }

    /** PRODUCT_RULE_012: the public catalog filters by the displayed sale price. */
    private static Expression<BigDecimal> effectivePriceExpression(
            CriteriaBuilder cb,
            Root<ProductEntity> root
    ) {
        Expression<BigDecimal> retail = root.get("retailPrice");
        Expression<BigDecimal> sale = root.get("salePrice");
        return cb.<BigDecimal>selectCase()
                .when(cb.and(
                        cb.greaterThan(sale, BigDecimal.ZERO),
                        cb.lessThan(sale, retail)), sale)
                .otherwise(retail);
    }

    private static Specification<ProductEntity> buildPublicListingSpec(
            Set<String> categoryIds,
            String brandSlug,
            String q,
            List<String> genders,
            Long minPrice,
            Long maxPrice,
            HomepageBlock homepageBlock,
            com.bigbike.bigbike_backend.service.common.SortSpec sortSpec
    ) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.equal(root.get("publishStatus"), PublishStatus.PUBLISHED));
            predicates.add(cb.isFalse(root.get("discontinued")));
            if (categoryIds != null) {
                if (categoryIds.isEmpty()) {
                    predicates.add(cb.disjunction());
                } else {
                    predicates.add(categoryMembership(root, query, cb, categoryIds));
                }
            }
            if (brandSlug != null && !brandSlug.isBlank()) {
                predicates.add(cb.equal(root.join("brand", JoinType.LEFT).get("slug"), brandSlug));
            }
            if (q != null && !q.isBlank()) {
                predicates.add(ProductFilterSpecifications.productTextSearch(root, cb, q));
            }
            List<String> activeGenders = ProductGenderSupport.firstSupported(genders);
            if (!activeGenders.isEmpty()) {
                String gender = activeGenders.get(0);
                predicates.add(ProductGenderSupport.MALE.equals(gender)
                        ? cb.isTrue(root.get("genderMale"))
                        : cb.isTrue(root.get("genderFemale")));
            }
            Expression<BigDecimal> effectivePrice = effectivePriceExpression(cb, root);
            if (minPrice != null) {
                predicates.add(cb.greaterThanOrEqualTo(effectivePrice, BigDecimal.valueOf(minPrice)));
            }
            if (maxPrice != null) {
                predicates.add(cb.lessThanOrEqualTo(effectivePrice, BigDecimal.valueOf(maxPrice)));
            }
            if (homepageBlock != null) {
                predicates.add(cb.equal(root.get("homepageBlock"), homepageBlock));
            }
            // Guard against the count query (Long result type does not support orderBy) —
            // same pattern as searchPublishedProducts() above.
            if (!Long.class.equals(query.getResultType())) {
                boolean desc = sortSpec.direction() == com.bigbike.bigbike_backend.service.common.SortDirection.DESC;
                switch (sortSpec.field()) {
                    case "name" -> {
                        Expression<String> nameLower = cb.lower(root.get("name"));
                        query.orderBy(desc ? cb.desc(nameLower) : cb.asc(nameLower));
                    }
                    case "price" -> {
                        query.orderBy(desc ? cb.desc(effectivePrice) : cb.asc(effectivePrice));
                    }
                    default -> {
                        Expression<java.time.Instant> created = root.get("createdAt");
                        query.orderBy(desc ? cb.desc(created) : cb.asc(created));
                    }
                }
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    @Override
    public List<Product> searchPublishedProducts(java.util.List<String> tokens, String locale, int limit) {
        if (tokens == null || tokens.isEmpty() || limit <= 0) {
            return List.of();
        }
        boolean english = LOCALE_EN.equalsIgnoreCase(locale);
        Specification<ProductEntity> spec = (root, query, cb) -> {
            java.util.List<Predicate> preds = new ArrayList<>();
            preds.add(cb.equal(root.get("publishStatus"), PublishStatus.PUBLISHED));
            preds.add(cb.isFalse(root.get("discontinued")));
            preds.add(ProductFilterSpecifications.productTextSearch(
                    root, cb, String.join(" ", tokens)));
            Expression<String> name = english
                    ? cb.<String>selectCase()
                            .when(cb.or(cb.isNull(root.get("nameEn")), cb.equal(cb.trim(root.get("nameEn")), "")), root.get("name"))
                            .otherwise(root.get("nameEn"))
                    : root.get("name");
            // Sort by name length ASC (shorter = more exact match), then alphabetically.
            // Guard against count query (Long) which does not support orderBy.
            if (!Long.class.equals(query.getResultType())) {
                query.orderBy(
                        cb.asc(cb.length(name)),
                        cb.asc(name));
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
    public List<Product> searchPublishedProductsForAssistant(
            List<String> tokens,
            String categorySlug,
            String brandSlug,
            Long minPrice,
            Long maxPrice,
            com.bigbike.bigbike_backend.service.common.SortSpec sortSpec,
            String locale,
            int limit
    ) {
        if (tokens == null || tokens.isEmpty() || limit <= 0) {
            return List.of();
        }
        Set<String> categoryIds = resolveCategorySlugWithDescendants(categorySlug);
        Specification<ProductEntity> spec = buildAssistantProductSearchSpec(
                tokens, categoryIds, brandSlug, minPrice, maxPrice, sortSpec);
        return productJpaRepository.findAll(
                        spec,
                        org.springframework.data.domain.PageRequest.of(0, Math.min(limit, 100)))
                .getContent()
                .stream()
                .map(entity -> toDomainListing(entity, locale))
                .toList();
    }

    /** Assistant search applies the same token semantics as the shared public/admin predicate. */
    private static Specification<ProductEntity> buildAssistantProductSearchSpec(
            List<String> tokens,
            Set<String> categoryIds,
            String brandSlug,
            Long minPrice,
            Long maxPrice,
            com.bigbike.bigbike_backend.service.common.SortSpec sortSpec
    ) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.equal(root.get("publishStatus"), PublishStatus.PUBLISHED));
            predicates.add(cb.isFalse(root.get("discontinued")));
            if (categoryIds != null) {
                if (categoryIds.isEmpty()) {
                    predicates.add(cb.disjunction());
                } else {
                    predicates.add(categoryMembership(root, query, cb, categoryIds));
                }
            }
            if (brandSlug != null && !brandSlug.isBlank()) {
                predicates.add(cb.equal(root.join("brand", JoinType.LEFT).get("slug"), brandSlug));
            }
            predicates.add(ProductFilterSpecifications.productTextSearch(
                    root, cb, String.join(" ", tokens)));
            Expression<BigDecimal> effectivePrice = effectivePriceExpression(cb, root);
            if (minPrice != null) {
                predicates.add(cb.greaterThanOrEqualTo(effectivePrice, BigDecimal.valueOf(minPrice)));
            }
            if (maxPrice != null) {
                predicates.add(cb.lessThanOrEqualTo(effectivePrice, BigDecimal.valueOf(maxPrice)));
            }
            if (!Long.class.equals(query.getResultType())) {
                boolean desc = sortSpec != null
                        && sortSpec.direction() == com.bigbike.bigbike_backend.service.common.SortDirection.DESC;
                String sortField = sortSpec == null ? "createdAt" : sortSpec.field();
                switch (sortField) {
                    case "name" -> query.orderBy(desc ? cb.desc(cb.lower(root.get("name")))
                            : cb.asc(cb.lower(root.get("name"))));
                    case "price" -> query.orderBy(desc ? cb.desc(effectivePrice)
                            : cb.asc(effectivePrice));
                    default -> query.orderBy(desc ? cb.desc(root.get("createdAt"))
                            : cb.asc(root.get("createdAt")));
                }
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    private static Expression<String> unaccentLower(CriteriaBuilder cb, Expression<?> value) {
        return cb.function("unaccent", String.class, cb.lower(value.as(String.class)));
    }

    /**
     * A correlated category join makes Hibernate emit SELECT DISTINCT. PostgreSQL then rejects
     * name sorting because LOWER(name) is not part of the selected entity columns. The bounded
     * id subquery preserves the same category membership without multiplying outer rows, so all
     * supported sort expressions remain legal and pagination totals stay exact.
     */
    private static Predicate categoryMembership(
            Root<ProductEntity> root,
            CriteriaQuery<?> query,
            CriteriaBuilder cb,
            Set<String> categoryIds
    ) {
        Subquery<String> productsInCategory = query.subquery(String.class);
        Root<ProductEntity> candidate = productsInCategory.from(ProductEntity.class);
        productsInCategory.select(candidate.get("id"));
        productsInCategory.where(candidate.join("categories", JoinType.INNER).get("id").in(categoryIds));
        return root.get("id").in(productsInCategory);
    }

    @Override
    public List<Product> findProductsFiltered(
            String query,
            String publishStatus,
            String stockState,
            String brandId,
            String categoryId,
            String gender,
            String locale
    ) {
        Set<String> categoryIds = ProductFilterSpecifications.resolveCategoryIds(
                categoryId, categoryJpaRepository.findAll());
        Specification<ProductEntity> spec = ProductFilterSpecifications.forAdminList(
                query, publishStatus, stockState, brandId, categoryIds, gender);
        return productJpaRepository.findAll(spec).stream()
                .map(entity -> toDomainListItem(entity, locale))
                .toList();
    }

    private Product toDomainListItem(ProductEntity entity, String locale) {
        List<CategorySummary> categories = toCategorySummaries(entity.getCategories(), locale);
        CategorySummary primaryCategory = categories.isEmpty() ? null : categories.get(0);
        return new Product(
                entity.getId(),
                entity.getSku(),
                entity.getSlug(),
                entity.getSlugEn(),
                pick(entity.getName(), entity.getNameEn(), locale),
                null,
                null,
                toBrandSummary(entity.getBrand(), locale),
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
                        entity.getSalePrice(),
                        entity.getCurrency()
                ),
                List.of(),
                entity.getStockState(),
                entity.getAvailable(),
                entity.getPublishStatus(),
                entity.isDiscontinued(),
                entity.getSizeScaleId(),
                entity.getHomepageBlock(),
                entity.getHomepageOrder(),
                entity.getRating(),
                entity.getRatingCount(),
                List.of(),                  // faqs — detail only
                List.of(),                  // commitments — detail only
                ProductHighlights.EMPTY,    // highlights — detail only
                null,                       // originBrandCountry — detail only
                null,                       // sizeGuide — detail only
                null,                       // suitabilityAdvisory — detail only
                null,                       // specifications — detail only
                null,                       // specStats — detail only
                null,                       // trustBadges — detail only
                null,                       // quickAnswerSummary — detail only
                ProductGenderSupport.fromFlags(entity.isGenderMale(), entity.isGenderFemale()),
                List.of(),                  // relatedProducts — detail only
                List.of(),                  // accessoryProducts — detail only
                null,                       // descriptionBlocks — detail only
                null,                       // suitabilitySection — detail only
                null,                       // sizeGuideSection — detail only
                null,                       // seo — detail only
                null,                       // translations — detail only (admin detail read)
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }

    /**
     * Storefront list/facets projection: same shape as {@link #toDomainListItem} (no
     * gallery/videos/faqs/commitments/highlights/
     * related/accessory) but ALSO carries variant + options — {@code toListView()} strips
     * options back out for the final list response, but facet computation (color/gender
     * buckets) and color filtering need them on the way in. Variant gallery is skipped
     * (list/facets never render variant media); see {@link #toVariantForListing}.
     */
    private Product toDomainListing(ProductEntity entity, String locale) {
        List<CategorySummary> categories = toCategorySummaries(entity.getCategories(), locale);
        CategorySummary primaryCategory = categories.isEmpty() ? null : categories.get(0);
        return new Product(
                entity.getId(),
                entity.getSku(),
                entity.getSlug(),
                entity.getSlugEn(),
                pick(entity.getName(), entity.getNameEn(), locale),
                pick(entity.getShortDescription(), entity.getShortDescriptionEn(), locale),
                null,
                toBrandSummary(entity.getBrand(), true, locale),
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
                        entity.getSalePrice(),
                        entity.getCurrency()
                ),
                toVariantsForListing(entity, locale),
                entity.getStockState(),
                entity.getAvailable(),
                entity.getPublishStatus(),
                entity.isDiscontinued(),
                entity.getSizeScaleId(),
                entity.getHomepageBlock(),
                entity.getHomepageOrder(),
                entity.getRating(),
                entity.getRatingCount(),
                List.of(),                  // faqs — detail only
                List.of(),                  // commitments — detail only
                ProductHighlights.EMPTY,    // highlights — detail only
                null,                       // originBrandCountry — detail only
                null,                       // sizeGuide — detail only
                null,                       // suitabilityAdvisory — detail only
                null,                       // specifications — detail only
                null,                       // specStats — detail only
                null,                       // trustBadges — detail only
                null,                       // quickAnswerSummary — detail only
                ProductGenderSupport.fromFlags(entity.isGenderMale(), entity.isGenderFemale()),
                List.of(),                  // relatedProducts — detail only
                List.of(),                  // accessoryProducts — detail only
                null,                       // descriptionBlocks — detail only
                null,                       // suitabilitySection — detail only
                null,                       // sizeGuideSection — detail only
                null,                       // seo — detail only
                null,                       // translations — admin detail read only
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }

    private List<ProductVariant> toVariantsForListing(ProductEntity entity, String locale) {
        if (entity.getVariants() == null) {
            return List.of();
        }
        return entity.getVariants().stream()
                .sorted(VARIANT_ORDER)
                .map(v -> toVariantForListing(v, entity, locale))
                .toList();
    }

    /** Same as {@link #toVariant} but skips gallery — list/facets never render variant media. */
    private ProductVariant toVariantForListing(ProductVariantEntity entity, ProductEntity product, String locale) {
        // PRODUCT_RULE_013: a variant without its own retailPrice falls back to the product's shared
        // retailPrice/salePrice (VariantPricing) — same rule used by cart/checkout pricing.
        BigDecimal effectiveRetail = VariantPricing.regularPrice(product, entity);
        ProductPrice price = effectiveRetail == null
                ? null
                : new ProductPrice(
                        effectiveRetail,
                        VariantPricing.salePrice(product, entity),
                        entity.getCurrency() == null ? "VND" : entity.getCurrency()
                );

        List<ProductVariantOption> options = entity.getOptions() == null
                ? List.of()
                : entity.getOptions().stream()
                        .sorted(VARIANT_OPTION_ORDER)
                        .map(option -> toVariantOption(option, true, locale))
                        .toList();

        return new ProductVariant(
                entity.getId(),
                entity.getSku(),
                entity.getName(),
                options,
                price,
                entity.getStockState(),
                null, // image — list/facets never render variant media
                List.of(),
                entity.isAvailable()
        );
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
    public Optional<Product> findProductBySlugForListing(String slug, String locale) {
        return productJpaRepository.findBySlug(slug)
                .or(() -> productJpaRepository.findBySlugEn(slug))
                .map(entity -> toDomainListing(entity, locale));
    }

    @Override
    public Optional<Product> findProductByIdPublicViewForListing(String id, String locale) {
        return productJpaRepository.findById(id).map(entity -> toDomainListing(entity, locale));
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
    @Cacheable(cacheNames = "catalog-reference-categories", key = "'default'")
    public List<Category> findAllCategories() {
        return categoryJpaRepository.findAll().stream()
                .filter(entity -> !entity.isDeleted())
                .map(this::toDomain)
                .toList();
    }

    @Override
    @Cacheable(cacheNames = "catalog-reference-categories", key = "'locale:' + #locale")
    public List<Category> findAllCategories(String locale) {
        return categoryJpaRepository.findAll().stream()
                .filter(entity -> !entity.isDeleted())
                .map(entity -> toDomain(entity, locale))
                .toList();
    }

    @Override
    @Cacheable(cacheNames = "catalog-reference-categories", key = "'locale:' + #locale + ':strict:' + #strictEnglish")
    public List<Category> findAllCategories(String locale, boolean strictEnglish) {
        return categoryJpaRepository.findAll().stream()
                .filter(entity -> !entity.isDeleted())
                .map(entity -> toDomain(entity, locale))
                .toList();
    }

    @Override
    public CategoryPage findCategoriesPaged(
            String query,
            String visibility,
            Boolean deleted,
            String sortField,
            boolean sortAsc,
            int page,
            int pageSize,
            String locale
    ) {
        Specification<CategoryEntity> spec = (root, cq, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (deleted != null) {
                predicates.add(cb.equal(root.get("deleted"), deleted));
            } else {
                predicates.add(cb.isFalse(root.get("deleted")));
            }
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
        return categoryJpaRepository.findBySlug(slug)
                .filter(entity -> !entity.isDeleted())
                .map(this::toDomain);
    }

    @Override
    public Optional<Category> findCategoryBySlug(String slug, String locale) {
        // vi slug first, then optional English slug (CATEGORY_RULE_003).
        return categoryJpaRepository.findBySlug(slug)
                .or(() -> categoryJpaRepository.findBySlugEn(slug))
                .filter(entity -> !entity.isDeleted())
                .map(entity -> toDomain(entity, locale));
    }

    @Override
    public Optional<Category> findCategoryById(String id) {
        return categoryJpaRepository.findById(id).map(this::toDomain);
    }

    @Override
    @Cacheable(cacheNames = "catalog-reference-brands", key = "'default'")
    public List<Brand> findAllBrands() {
        return brandJpaRepository.findAll().stream().map(this::toDomain).toList();
    }

    @Override
    @Cacheable(cacheNames = "catalog-reference-brands", key = "'locale:' + #locale")
    public List<Brand> findAllBrands(String locale) {
        return brandJpaRepository.findAll().stream()
                .map(entity -> toDomain(entity, locale))
                .toList();
    }

    @Override
    @Cacheable(cacheNames = "catalog-reference-brands", key = "'locale:' + #locale + ':strict:' + #strictEnglish")
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
        return brandJpaRepository.findBySlug(slug)
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
        List<CategorySummary> categories = toCategorySummaries(entity.getCategories(), locale);
        CategorySummary primaryCategory = categories.isEmpty() ? null : categories.get(0);

        return new Product(
                entity.getId(),
                entity.getSku(),
                entity.getSlug(),
                entity.getSlugEn(),
                pick(entity.getName(), entity.getNameEn(), locale),
                pick(entity.getShortDescription(), entity.getShortDescriptionEn(), locale),
                pick(entity.getDescription(), entity.getDescriptionEn(), locale),
                toBrandSummary(entity.getBrand(), publicView, locale),
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
                        entity.getSalePrice(),
                        entity.getCurrency()
                ),
                toVariants(entity, publicView, locale),
                entity.getStockState(),
                entity.getAvailable(),
                entity.getPublishStatus(),
                entity.isDiscontinued(),
                entity.getSizeScaleId(),
                entity.getHomepageBlock(),
                entity.getHomepageOrder(),
                entity.getRating(),
                entity.getRatingCount(),
                toFaqs(entity, publicView, locale),
                toCommitments(entity, publicView, locale),
                toHighlights(entity, publicView, locale),
                pick(entity.getOriginBrandCountry(), entity.getOriginBrandCountryEn(), locale),
                entity.getSizeGuide(),
                pick(entity.getSuitabilityAdvisory(), entity.getSuitabilityAdvisoryEn(), locale),
                pick(entity.getSpecifications(), entity.getSpecificationsEn(), locale),
                pick(entity.getSpecStats(), entity.getSpecStatsEn(), locale),
                pick(entity.getTrustBadges(), entity.getTrustBadgesEn(), locale),
                pick(entity.getQuickAnswerSummary(), entity.getQuickAnswerSummaryEn(), locale),
                ProductGenderSupport.fromFlags(entity.isGenderMale(), entity.isGenderFemale()),
                toRelatedProducts(entity, publicView, locale),
                toAccessoryProducts(entity, publicView, locale),
                publicView
                        ? resolveDescriptionBlocksForPublic(entity.getDescriptionBlocks(), locale)
                        : entity.getDescriptionBlocks(),
                publicView
                        ? resolveSuitabilitySectionForPublic(entity.getSuitabilitySection(), locale)
                        : entity.getSuitabilitySection(),
                publicView
                        ? resolveSizeGuideSectionForPublic(entity.getSizeGuideSection(), locale)
                        : entity.getSizeGuideSection(),
                toSeoMeta(
                        pick(entity.getSeoTitle(), entity.getSeoTitleEn(), locale),
                        pick(entity.getSeoDescription(), entity.getSeoDescriptionEn(), locale),
                        entity.getSeoCanonicalUrl(),
                        entity.getSeoOgImageId(),
                        entity.getSeoOgImageUrl(),
                        entity.getSeoOgImageAlt(),
                        entity.getSeoOgImageWidth(),
                        entity.getSeoOgImageHeight(),
                        entity.getSeoOgImageMimeType(),
                        SeoIndexPolicy.resolveNoIndex(
                                locale,
                                entity.isSeoNoIndex(),
                                entity.isSeoNoIndexEn(),
                                SeoIndexPolicy.productEnglishReady(
                                        entity.getNameEn(),
                                        entity.getShortDescriptionEn(),
                                        entity.getDescriptionEn()
                                )
                        )
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
                        entity.getSeoOgImageMimeType(),
                        SeoIndexPolicy.resolveNoIndex(
                                locale,
                                entity.isSeoNoIndex(),
                                entity.isSeoNoIndexEn(),
                                SeoIndexPolicy.categoryEnglishReady(
                                        entity.getNameEn(),
                                        entity.getDescriptionEn(),
                                        entity.getIntroContentEn()
                                )
                        )
                ),
                entity.isVisible(),
                entity.isDeleted(),
                entity.getShowOnHomepage(),
                entity.getSortOrder(),
                pick(entity.getIntroContent(), entity.getIntroContentEn(), locale),
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
                entity.getName(),
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
                        entity.getSeoOgImageMimeType(),
                        SeoIndexPolicy.resolveNoIndex(
                                locale,
                                entity.isSeoNoIndex(),
                                entity.isSeoNoIndexEn(),
                                SeoIndexPolicy.brandEnglishReady(entity.getDescriptionEn())
                        )
                ),
                entity.isVisible(),
                entity.isShowOnHomepage(),
                includeTranslations ? toBrandTranslations(entity) : null,
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }

    private List<GalleryMedia> toGallery(ProductEntity entity) {
        return entity.getGallery() == null ? List.of() : entity.getGallery();
    }

    /** Map một dòng gallery (ảnh/video) → {@link GalleryMedia}. Null khi thiếu nội dung (ảnh rỗng / video thiếu url). */
    private GalleryMedia toGalleryMedia(
            String mediaType, String videoUrl, String videoProvider,
            String imageId, String imageUrl, String imageAlt,
            Integer width, Integer height, String mimeType) {
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
        return entity.getVideos() == null ? List.of() : entity.getVideos();
    }

    /**
     * Ưu/Nhược điểm (V175) resolved theo locale. Nguồn dữ liệu là 1 field JSONB duy nhất
     * ({@code products.highlights}) đã pre-split sẵn thành {@code positiveNotes}/{@code negativeNotes}
     * (V331/V332 — không còn lọc theo {@code kind} trên 1 bảng con phẳng). {@code contentEn} (admin only).
     */
    private ProductHighlights toHighlights(ProductEntity entity, boolean publicView, String locale) {
        ProductHighlights source = entity.getHighlights();
        if (source == null) {
            return ProductHighlights.EMPTY;
        }
        return new ProductHighlights(
                toHighlightList(source.positiveNotes(), publicView, locale),
                toHighlightList(source.negativeNotes(), publicView, locale));
    }

    private List<ProductHighlight> toHighlightList(List<ProductHighlight> items, boolean publicView, String locale) {
        if (items == null) {
            return List.of();
        }
        return items.stream()
                .map(item -> new ProductHighlight(
                        pick(item.content(), item.contentEn(), locale),
                        publicView ? null : item.contentEn()
                ))
                .toList();
    }

    /**
     * Product FAQ entries (V133) resolved for the requested locale, read from the
     * {@code products.faqs} JSONB column (V331/V332). On admin reads the raw English
     * values ride along in the {@code *En} fields.
     */
    private List<ProductFaq> toFaqs(ProductEntity entity, boolean publicView, String locale) {
        if (entity.getFaqs() == null) {
            return List.of();
        }
        return entity.getFaqs().stream()
                .map(item -> new ProductFaq(
                        pick(item.question(), item.questionEn(), locale),
                        pick(item.answer(), item.answerEn(), locale),
                        publicView ? null : item.questionEn(),
                        publicView ? null : item.answerEn()
                ))
                .toList();
    }

    /**
     * Per-product commitment rows (V232) resolved for the requested locale, read from
     * the {@code products.commitments} JSONB column (V331/V332). On admin reads the raw
     * English values ride along in the {@code *En} fields.
     */
    private List<ProductCommitment> toCommitments(ProductEntity entity, boolean publicView, String locale) {
        if (entity.getCommitments() == null) {
            return List.of();
        }
        return entity.getCommitments().stream()
                .map(item -> new ProductCommitment(
                        item.icon(),
                        pick(item.title(), item.titleEn(), locale),
                        pick(item.subtitle(), item.subtitleEn(), locale),
                        publicView ? null : item.titleEn(),
                        publicView ? null : item.subtitleEn()
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
                .map(v -> toVariant(v, entity, publicView, locale))
                .toList();
        return withColorScopedVariantMedia(variants);
    }

    private ProductVariant toVariant(ProductVariantEntity entity, ProductEntity product, boolean publicView, String locale) {
        // PRODUCT_RULE_013: a variant without its own retailPrice falls back to the product's shared
        // retailPrice/salePrice (VariantPricing) — same rule used by cart/checkout pricing.
        BigDecimal effectiveRetail = VariantPricing.regularPrice(product, entity);
        ProductPrice price = effectiveRetail == null
                ? null
                : new ProductPrice(
                        effectiveRetail,
                        VariantPricing.salePrice(product, entity),
                        entity.getCurrency() == null ? "VND" : entity.getCurrency()
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

        return new ProductVariant(
                entity.getId(),
                entity.getSku(),
                entity.getName(),
                options,
                price,
                entity.getStockState(),
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
     * Build a {@link ProductVariantOption} from one stored option row, resolving
     * the AttributeValue dictionary lazily so the read path can return the human
     * label ("Đen bóng") rather than the raw slug. The lazy-resolution chain below
     * fires whenever the persisted FK is null, OR is populated but disagrees with
     * the option's own text (slug/label normalised mismatch, discarded up front —
     * see {@link #matchesOptionValue}) — the latter guards against a stale FK left
     * behind by a free-text edit of a sibling value under the same attribute (e.g.
     * "XXL" vs "XXXL"). Colour variants render on the storefront from the
     * variant's own gallery image (see {@code VariantSelector.tsx}), so no
     * per-term swatch or hex value is surfaced here.
     */
    private ProductVariantOption toVariantOption(ProductVariantOptionEntity option, boolean publicView, String locale) {
        AttributeEntity attribute = option.getAttribute();
        AttributeValueEntity value = option.getAttributeValue();

        // V1047 bảo đảm cả hai khoá ngoại; không dò lại bằng văn bản tại đây.
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

    private List<CategorySummary> toCategorySummaries(List<CategoryEntity> entities, String locale) {
        if (entities == null || entities.isEmpty()) {
            return List.of();
        }
        return entities.stream().map(entity -> toCategorySummary(entity, locale)).toList();
    }

    private CategorySummary toCategorySummary(CategoryEntity entity, String locale) {
        if (entity == null) {
            return null;
        }
        return new CategorySummary(entity.getId(), entity.getSlug(), entity.getSlugEn(),
                pick(entity.getName(), entity.getNameEn(), locale), entity.isVisible(), entity.isDeleted());
    }

    private BrandSummary toBrandSummary(BrandEntity entity, String locale) {
        return toBrandSummary(entity, false, locale);
    }

    private BrandSummary toBrandSummary(BrandEntity entity, boolean publicView, String locale) {
        if (entity == null) {
            return null;
        }
        if (publicView && !entity.isVisible()) {
            return null;
        }
        return new BrandSummary(entity.getId(), entity.getSlug(), entity.getName());
    }
}
