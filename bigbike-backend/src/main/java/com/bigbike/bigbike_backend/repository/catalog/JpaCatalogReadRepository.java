package com.bigbike.bigbike_backend.repository.catalog;

import com.bigbike.bigbike_backend.domain.catalog.Brand;
import com.bigbike.bigbike_backend.domain.catalog.BrandSummary;
import com.bigbike.bigbike_backend.domain.catalog.Category;
import com.bigbike.bigbike_backend.domain.catalog.CategorySummary;
import com.bigbike.bigbike_backend.domain.catalog.ImageAsset;
import com.bigbike.bigbike_backend.domain.catalog.Product;
import com.bigbike.bigbike_backend.domain.catalog.ProductFaq;
import com.bigbike.bigbike_backend.domain.catalog.ProductPrice;
import com.bigbike.bigbike_backend.domain.catalog.ProductSpecification;
import com.bigbike.bigbike_backend.domain.catalog.ProductTranslations;
import com.bigbike.bigbike_backend.domain.catalog.CategoryTranslations;
import com.bigbike.bigbike_backend.domain.catalog.BrandTranslations;
import com.bigbike.bigbike_backend.domain.catalog.ProductVariant;
import com.bigbike.bigbike_backend.domain.catalog.ProductVariantOption;
import com.bigbike.bigbike_backend.domain.catalog.SeoMeta;
import com.bigbike.bigbike_backend.domain.catalog.VideoAsset;
import com.bigbike.bigbike_backend.persistence.entity.catalog.BrandEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.CategoryEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductGalleryImageEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantGalleryImageEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductSpecificationEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductFaqEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantOptionEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVideoEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.AttributeEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.AttributeValueEntity;
import com.bigbike.bigbike_backend.persistence.entity.media.MediaEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.AttributeJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.AttributeValueJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.BrandJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.CategoryJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.media.MediaJpaRepository;
import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Primary;
import org.springframework.context.annotation.Profile;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
@Primary
@Profile("!mock")
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class JpaCatalogReadRepository implements CatalogReadRepository {

    private static final Set<String> COLOR_ATTRIBUTE_KEYS = Set.of(
            "color", "colour", "mau", "mau sac", "pa color", "pa mau", "pa mau sac"
    );
    private static final Comparator<ProductGalleryImageEntity> GALLERY_ORDER = Comparator.comparingInt(ProductGalleryImageEntity::getSortOrder);
    private static final Comparator<ProductVariantGalleryImageEntity> VARIANT_GALLERY_ORDER = Comparator.comparingInt(ProductVariantGalleryImageEntity::getSortOrder);
    private static final Comparator<ProductVideoEntity> VIDEO_ORDER = Comparator.comparingInt(ProductVideoEntity::getSortOrder);
    private static final Comparator<ProductSpecificationEntity> SPEC_ORDER = Comparator.comparingInt(ProductSpecificationEntity::getSortOrder);
    private static final Comparator<ProductFaqEntity> FAQ_ORDER = Comparator.comparingInt(ProductFaqEntity::getSortOrder);
    private static final Comparator<ProductVariantEntity> VARIANT_ORDER = Comparator.comparingInt(ProductVariantEntity::getSortOrder);
    private static final Comparator<ProductVariantOptionEntity> VARIANT_OPTION_ORDER = Comparator.comparingInt(ProductVariantOptionEntity::getSortOrder);

    private static final String LOCALE_VI = "vi";
    private static final String LOCALE_EN = "en";

    /**
     * Resolve one translatable field for the requested locale. English content
     * falls back to Vietnamese field-by-field when the {@code _en} column is
     * blank (see {@code BUSINESS_RULES.md PRODUCT_RULE_002}).
     */
    private static String pick(String base, String en, String locale) {
        if (LOCALE_EN.equals(locale) && en != null && !en.isBlank()) {
            return en;
        }
        return base;
    }

    private final ProductJpaRepository productJpaRepository;
    private final CategoryJpaRepository categoryJpaRepository;
    private final BrandJpaRepository brandJpaRepository;
    private final MediaJpaRepository mediaJpaRepository;
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
    public List<Product> findProductsFiltered(String query, String publishStatus, String stockState, String brandId, String categoryId) {
        Specification<ProductEntity> spec = buildProductSpec(query, publishStatus, stockState, brandId, categoryId);
        return productJpaRepository.findAll(spec).stream()
                .map(entity -> toDomainListItem(entity, LOCALE_VI))
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
                        entity.getCurrency()
                ),
                List.of(),
                List.of(),
                entity.getStockState(),
                entity.getStockQuantity(),
                entity.getForceOutOfStock(),
                entity.getPublishStatus(),
                entity.getHomepageBlock(),
                entity.getHomepageOrder(),
                entity.getRating(),
                entity.getRatingCount(),
                null,
                null,
                null,                       // installationGuide — detail only
                List.of(),                  // faqs — detail only
                List.of(),                  // relatedProducts — detail only
                null,                       // descriptionBlocks — detail only
                null,
                null,                       // translations — detail only (admin detail read)
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }

    private static Specification<ProductEntity> buildProductSpec(String query, String publishStatus, String stockState, String brandId, String categoryId) {
        return (root, criteriaQuery, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (publishStatus == null || publishStatus.isBlank() || "ALL".equalsIgnoreCase(publishStatus)) {
                predicates.add(cb.notEqual(root.get("publishStatus"), PublishStatus.TRASH));
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
                Predicate primaryMatch = cb.equal(root.get("category").get("id"), categoryId);
                Predicate m2mMatch = cb.equal(root.join("categories", JoinType.LEFT).get("id"), categoryId);
                predicates.add(cb.or(primaryMatch, m2mMatch));
                criteriaQuery.distinct(true);
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    @Override
    public Optional<Product> findProductBySlug(String slug, String locale) {
        return productJpaRepository.findBySlug(slug).map(entity -> toDomainPublicView(entity, locale));
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
    public CategoryPage findCategoriesPaged(
            String query,
            String visibility,
            String sortField,
            boolean sortAsc,
            int page,
            int pageSize
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

        List<Category> items = result.getContent().stream().map(this::toDomain).toList();
        return new CategoryPage(items, result.getTotalElements());
    }

    @Override
    public Optional<Category> findCategoryBySlug(String slug) {
        return categoryJpaRepository.findBySlug(slug).map(this::toDomain);
    }

    @Override
    public Optional<Category> findCategoryBySlug(String slug, String locale) {
        return categoryJpaRepository.findBySlug(slug).map(entity -> toDomain(entity, locale));
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
    public Optional<Brand> findBrandBySlug(String slug) {
        return brandJpaRepository.findBySlug(slug).map(this::toDomain);
    }

    @Override
    public Optional<Brand> findBrandBySlug(String slug, String locale) {
        return brandJpaRepository.findBySlug(slug).map(entity -> toDomain(entity, locale));
    }

    @Override
    public Optional<Brand> findBrandById(String id) {
        return brandJpaRepository.findById(id).map(this::toDomain);
    }

    private Product toDomainPublicView(ProductEntity entity, String locale) {
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

    /**
     * Mask on-hand stock count for public-facing responses. Guests/customers see exact
     * count only when state is LOW_STOCK and quantity is small enough to drive urgency
     * ("Chỉ còn N sản phẩm") — otherwise null, so scrapers cannot read precise inventory
     * for every SKU. Admin reads (publicView=false) get the raw value untouched.
     */
    private static Integer maskStockQuantityForPublic(Integer raw, ProductStockState state) {
        if (raw == null || state != ProductStockState.LOW_STOCK) return null;
        if (raw <= 0 || raw > 10) return null;
        return raw;
    }

    private Product toDomain(ProductEntity entity, boolean publicView, String locale) {
        CategorySummary primaryCategory = toCategorySummary(entity.getCategory());
        List<CategorySummary> categories = primaryCategory == null
                ? List.of()
                : List.of(primaryCategory);

        Integer productStockQty = publicView
                ? maskStockQuantityForPublic(entity.getStockQuantity(), entity.getStockState())
                : entity.getStockQuantity();

        return new Product(
                entity.getId(),
                entity.getSku(),
                entity.getSlug(),
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
                        entity.getCurrency()
                ),
                toVariants(entity, publicView),
                toSpecifications(entity, publicView, locale),
                entity.getStockState(),
                productStockQty,
                entity.getForceOutOfStock(),
                entity.getPublishStatus(),
                entity.getHomepageBlock(),
                entity.getHomepageOrder(),
                entity.getRating(),
                entity.getRatingCount(),
                pick(entity.getContentBottom(), entity.getContentBottomEn(), locale),
                pick(entity.getPromotionContent(), entity.getPromotionContentEn(), locale),
                pick(entity.getInstallationGuide(), entity.getInstallationGuideEn(), locale),
                toFaqs(entity, publicView, locale),
                toRelatedProducts(entity, publicView, locale),
                entity.getDescriptionBlocks(),
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
                        entity.getSeoNoIndex()
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
                        entity.getSeoNoIndex()
                ),
                entity.isVisible(),
                entity.getShowOnHomepage(),
                entity.getSortOrder(),
                includeTranslations ? toCategoryTranslations(entity) : null,
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }

    private static CategoryTranslations toCategoryTranslations(CategoryEntity entity) {
        boolean anyEnglish = isPresent(entity.getNameEn())
                || isPresent(entity.getDescriptionEn())
                || isPresent(entity.getSeoTitleEn())
                || isPresent(entity.getSeoDescriptionEn());
        if (!anyEnglish) return null;
        return new CategoryTranslations(new CategoryTranslations.CategoryContent(
                entity.getNameEn(),
                entity.getDescriptionEn(),
                entity.getSeoTitleEn(),
                entity.getSeoDescriptionEn()
        ));
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
                        entity.getSeoNoIndex()
                ),
                entity.isVisible(),
                includeTranslations ? toBrandTranslations(entity) : null,
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }

    private static BrandTranslations toBrandTranslations(BrandEntity entity) {
        boolean anyEnglish = isPresent(entity.getNameEn())
                || isPresent(entity.getDescriptionEn())
                || isPresent(entity.getSeoTitleEn())
                || isPresent(entity.getSeoDescriptionEn());
        if (!anyEnglish) return null;
        return new BrandTranslations(new BrandTranslations.BrandContent(
                entity.getNameEn(),
                entity.getDescriptionEn(),
                entity.getSeoTitleEn(),
                entity.getSeoDescriptionEn()
        ));
    }

    private List<ImageAsset> toGallery(ProductEntity entity) {
        if (entity.getGallery() == null) {
            return List.of();
        }
        return entity.getGallery().stream()
                .sorted(GALLERY_ORDER)
                .map(item -> toImageAsset(
                        item.getImageId(),
                        item.getImageUrl(),
                        item.getImageAlt(),
                        item.getImageWidth(),
                        item.getImageHeight(),
                        item.getImageMimeType()
                ))
                .filter(image -> image != null)
                .toList();
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
                        item.getProvider()
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
     * Raw English product-level content for admin detail reads. Returns
     * {@code null} when no English content exists at all, so the public response
     * shape is unchanged and the admin editor can detect "no translation yet".
     */
    private static ProductTranslations toTranslations(ProductEntity entity) {
        boolean anyEnglish = isPresent(entity.getNameEn())
                || isPresent(entity.getShortDescriptionEn())
                || isPresent(entity.getDescriptionEn())
                || isPresent(entity.getContentBottomEn())
                || isPresent(entity.getPromotionContentEn())
                || isPresent(entity.getInstallationGuideEn())
                || isPresent(entity.getSeoTitleEn())
                || isPresent(entity.getSeoDescriptionEn());
        if (!anyEnglish) {
            return null;
        }
        return new ProductTranslations(new ProductTranslations.ProductContent(
                entity.getNameEn(),
                entity.getShortDescriptionEn(),
                entity.getDescriptionEn(),
                entity.getContentBottomEn(),
                entity.getPromotionContentEn(),
                entity.getInstallationGuideEn(),
                entity.getSeoTitleEn(),
                entity.getSeoDescriptionEn()
        ));
    }

    private static boolean isPresent(String value) {
        return value != null && !value.isBlank();
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

    private List<ProductVariant> toVariants(ProductEntity entity, boolean publicView) {
        if (entity.getVariants() == null) {
            return List.of();
        }
        List<ProductVariant> variants = entity.getVariants().stream()
                .sorted(VARIANT_ORDER)
                .map(v -> toVariant(v, publicView))
                .toList();
        return withColorScopedVariantMedia(variants);
    }

    /**
     * Force every variant in the same color group to expose the same {@code image}
     * and {@code gallery}. The write path already scopes both fields by color
     * ({@link com.bigbike.bigbike_backend.service.admin.AdminCatalogMutationService}),
     * but legacy WordPress imports persisted these per-variant rows independently
     * — and any future write path that bypasses the mutation service could too.
     * Scoping on read keeps the storefront, mobile app, and admin form aligned
     * with the "image and gallery are color-scoped" invariant regardless of how
     * the rows landed in the DB.
     *
     * Variants without a recognised color attribute have both fields cleared
     * since the gallery validator rejects per-variant gallery without a color
     * — keeping image alive for those rows would be the only place where the
     * read response disagreed with the write response.
     */
    private static List<ProductVariant> withColorScopedVariantMedia(List<ProductVariant> variants) {
        Map<String, List<ImageAsset>> galleryByColor = new HashMap<>();
        Map<String, ImageAsset> imageByColor = new HashMap<>();
        for (ProductVariant variant : variants) {
            String colorKey = variantColorKey(variant);
            if (colorKey == null) continue;
            if (variant.gallery() != null && !variant.gallery().isEmpty()) {
                galleryByColor.putIfAbsent(colorKey, variant.gallery());
            }
            if (variant.image() != null) {
                imageByColor.putIfAbsent(colorKey, variant.image());
            }
        }

        return variants.stream()
                .map(variant -> {
                    String colorKey = variantColorKey(variant);
                    List<ImageAsset> gallery = colorKey == null
                            ? List.of()
                            : galleryByColor.getOrDefault(colorKey, List.of());
                    ImageAsset image = colorKey == null
                            ? null
                            : imageByColor.get(colorKey);
                    return new ProductVariant(
                            variant.id(),
                            variant.sku(),
                            variant.name(),
                            variant.options(),
                            variant.price(),
                            variant.stockState(),
                            variant.stockQuantity(),
                            image,
                            gallery,
                            variant.isAvailable(),
                            variant.trackSerials()
                    );
                })
                .toList();
    }

    private static String variantColorKey(ProductVariant variant) {
        if (variant.options() == null) return null;
        for (ProductVariantOption option : variant.options()) {
            if (option == null) continue;
            if (isColorAttributeName(option.name())) {
                String value = normalizeVariantToken(option.value());
                return value.isEmpty() ? null : value;
            }
        }
        return null;
    }

    private static boolean isColorAttributeName(String name) {
        return COLOR_ATTRIBUTE_KEYS.contains(normalizeVariantToken(name));
    }

    private static String normalizeVariantToken(String raw) {
        if (raw == null || raw.isBlank()) return "";
        return Normalizer.normalize(raw.trim(), Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .replace('\u0110', 'D')
                .replace('\u0111', 'd')
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", " ")
                .trim();
    }

    private ProductVariant toVariant(ProductVariantEntity entity, boolean publicView) {
        ProductPrice price = entity.getRetailPrice() == null
                ? null
                : new ProductPrice(
                        entity.getRetailPrice(),
                        entity.getCompareAtPrice(),
                        entity.getSalePrice(),
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
                        .map(this::toVariantOption)
                        .toList();

        List<ImageAsset> gallery = entity.getGallery() == null
                ? List.of()
                : entity.getGallery().stream()
                        .sorted(VARIANT_GALLERY_ORDER)
                        .map(item -> toImageAsset(
                                item.getImageId(),
                                item.getImageUrl(),
                                item.getImageAlt(),
                                item.getImageWidth(),
                                item.getImageHeight(),
                                item.getImageMimeType()
                        ))
                        .filter(image -> image != null)
                        .toList();

        Integer variantStockQty;
        if (publicView) {
            variantStockQty = maskStockQuantityForPublic(entity.getQuantityOnHand(), entity.getStockState());
        } else {
            variantStockQty = entity.getQuantityOnHand();
        }

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
                entity.isAvailable(),
                entity.isTrackSerials()
        );
    }

    /**
     * Build a {@link ProductVariantOption} from one stored option row,
     * resolving the AttributeValue dictionary lazily when the FK is null.
     * Without the lazy lookup, products imported / saved before V42's
     * backfill would render text-only chips even though the per-term
     * swatch metadata exists in the dictionary tables.
     */
    private ProductVariantOption toVariantOption(ProductVariantOptionEntity option) {
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
                }
            }
        }

        // Priority 1: direct swatch picked by admin on this variant option row
        String resolvedSwatchUrl = resolveSwatchUrl(option.getSwatchImageId());
        // Priority 2: dictionary swatch from attribute_values (existing behaviour)
        if (resolvedSwatchUrl == null && value != null) {
            resolvedSwatchUrl = resolveSwatchUrl(value.getSwatchImageId());
        }

        return new ProductVariantOption(
                preferLabel(
                        attribute != null ? attribute.getName() : null,
                        option.getOptionName()
                ),
                preferLabel(
                        value != null ? value.getLabel() : null,
                        option.getOptionValue()
                ),
                value != null ? value.getColorHex() : null,
                resolvedSwatchUrl
        );
    }

    /** Returns the first non-blank value, or empty string if neither has content. */
    private static String preferLabel(String preferred, String fallback) {
        if (preferred != null && !preferred.isBlank()) return preferred;
        if (fallback != null && !fallback.isBlank()) return fallback;
        return "";
    }

    /**
     * Resolve a value stored in {@code attribute_values.swatch_image_id} to a public URL.
     * Handles three formats (newest-first precedence):
     * - Direct URL (new admin uploads store the publicUrl directly)
     * - UUID string (media entity primary key)
     * - Numeric string (legacy WP attachment ID from migration importer)
     * Returns null silently when the value is blank or unresolvable.
     */
    private String resolveSwatchUrl(String swatchImageId) {
        if (swatchImageId == null || swatchImageId.isBlank()) return null;
        final String trimmed = swatchImageId.trim();
        // Direct URL — new admin uploads store publicUrl in this column
        if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
        // UUID lookup — media entity primary key
        try {
            java.util.UUID uuid = java.util.UUID.fromString(trimmed);
            return mediaJpaRepository.findById(uuid)
                    .map(MediaEntity::getPublicUrl)
                    .filter(url -> url != null && !url.isBlank())
                    .orElse(null);
        } catch (IllegalArgumentException ignored) {
            // not a UUID — fall through
        }
        // Fallback: legacy WP attachment numeric ID
        try {
            long legacyId = Long.parseLong(trimmed);
            return mediaJpaRepository.findByLegacyId(legacyId)
                    .map(MediaEntity::getPublicUrl)
                    .filter(url -> url != null && !url.isBlank())
                    .orElse(null);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private CategorySummary toCategorySummary(CategoryEntity entity) {
        if (entity == null) {
            return null;
        }
        return new CategorySummary(entity.getId(), entity.getSlug(), entity.getName());
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
        return new BrandSummary(entity.getId(), entity.getSlug(), entity.getName());
    }

    private static ImageAsset toImageAsset(
            String id,
            String url,
            String alt,
            Integer width,
            Integer height,
            String mimeType
    ) {
        if (url == null || url.isBlank()) {
            return null;
        }
        return new ImageAsset(id, url, alt, width, height, mimeType);
    }

    private static SeoMeta toSeoMeta(
            String title,
            String description,
            String canonicalUrl,
            String ogImageId,
            String ogImageUrl,
            String ogImageAlt,
            Integer ogImageWidth,
            Integer ogImageHeight,
            String ogImageMimeType,
            Boolean noIndex
    ) {
        if ((title == null || title.isBlank())
                && (description == null || description.isBlank())
                && (canonicalUrl == null || canonicalUrl.isBlank())
                && (ogImageUrl == null || ogImageUrl.isBlank())
                && noIndex == null) {
            return null;
        }

        return new SeoMeta(
                title,
                description,
                canonicalUrl,
                toImageAsset(ogImageId, ogImageUrl, ogImageAlt, ogImageWidth, ogImageHeight, ogImageMimeType),
                noIndex
        );
    }
}
