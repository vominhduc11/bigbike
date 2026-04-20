package com.bigbike.bigbike_backend.repository.catalog;

import com.bigbike.bigbike_backend.domain.catalog.Brand;
import com.bigbike.bigbike_backend.domain.catalog.BrandSummary;
import com.bigbike.bigbike_backend.domain.catalog.Category;
import com.bigbike.bigbike_backend.domain.catalog.CategorySummary;
import com.bigbike.bigbike_backend.domain.catalog.ImageAsset;
import com.bigbike.bigbike_backend.domain.catalog.Product;
import com.bigbike.bigbike_backend.domain.catalog.ProductPrice;
import com.bigbike.bigbike_backend.domain.catalog.ProductSpecification;
import com.bigbike.bigbike_backend.domain.catalog.ProductVariant;
import com.bigbike.bigbike_backend.domain.catalog.ProductVariantOption;
import com.bigbike.bigbike_backend.domain.catalog.SeoMeta;
import com.bigbike.bigbike_backend.domain.catalog.VideoAsset;
import com.bigbike.bigbike_backend.persistence.entity.catalog.BrandEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.CategoryEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductGalleryImageEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductSpecificationEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantOptionEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVideoEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.BrandJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.CategoryJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import org.springframework.context.annotation.Primary;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
@Primary
@Profile("!mock")
@Transactional(readOnly = true)
public class JpaCatalogReadRepository implements CatalogReadRepository {

    private static final Comparator<ProductGalleryImageEntity> GALLERY_ORDER = Comparator.comparingInt(ProductGalleryImageEntity::getSortOrder);
    private static final Comparator<ProductVideoEntity> VIDEO_ORDER = Comparator.comparingInt(ProductVideoEntity::getSortOrder);
    private static final Comparator<ProductSpecificationEntity> SPEC_ORDER = Comparator.comparingInt(ProductSpecificationEntity::getSortOrder);
    private static final Comparator<ProductVariantEntity> VARIANT_ORDER = Comparator.comparingInt(ProductVariantEntity::getSortOrder);
    private static final Comparator<ProductVariantOptionEntity> VARIANT_OPTION_ORDER = Comparator.comparingInt(ProductVariantOptionEntity::getSortOrder);

    private final ProductJpaRepository productJpaRepository;
    private final CategoryJpaRepository categoryJpaRepository;
    private final BrandJpaRepository brandJpaRepository;

    public JpaCatalogReadRepository(
            ProductJpaRepository productJpaRepository,
            CategoryJpaRepository categoryJpaRepository,
            BrandJpaRepository brandJpaRepository
    ) {
        this.productJpaRepository = productJpaRepository;
        this.categoryJpaRepository = categoryJpaRepository;
        this.brandJpaRepository = brandJpaRepository;
    }

    @Override
    public List<Product> findAllProducts() {
        return productJpaRepository.findAll().stream().map(this::toDomain).toList();
    }

    @Override
    public Optional<Product> findProductBySlug(String slug) {
        return productJpaRepository.findBySlug(slug).map(this::toDomain);
    }

    @Override
    public Optional<Product> findProductById(String id) {
        return productJpaRepository.findById(id).map(this::toDomain);
    }

    @Override
    public List<Category> findAllCategories() {
        return categoryJpaRepository.findAll().stream().map(this::toDomain).toList();
    }

    @Override
    public Optional<Category> findCategoryBySlug(String slug) {
        return categoryJpaRepository.findBySlug(slug).map(this::toDomain);
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
    public Optional<Brand> findBrandBySlug(String slug) {
        return brandJpaRepository.findBySlug(slug).map(this::toDomain);
    }

    @Override
    public Optional<Brand> findBrandById(String id) {
        return brandJpaRepository.findById(id).map(this::toDomain);
    }

    private Product toDomain(ProductEntity entity) {
        CategorySummary primaryCategory = toCategorySummary(entity.getCategory());
        List<CategorySummary> categories = entity.getCategories() == null
                ? List.of()
                : entity.getCategories().stream()
                        .map(this::toCategorySummary)
                        .sorted(Comparator.comparing(CategorySummary::name, String.CASE_INSENSITIVE_ORDER))
                        .toList();

        if (categories.isEmpty() && primaryCategory != null) {
            categories = List.of(primaryCategory);
        }

        return new Product(
                entity.getId(),
                entity.getSku(),
                entity.getSlug(),
                entity.getName(),
                entity.getShortDescription(),
                entity.getDescription(),
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
                toGallery(entity),
                toVideos(entity),
                new ProductPrice(
                        entity.getRetailPrice(),
                        entity.getCompareAtPrice(),
                        entity.getSalePrice(),
                        entity.getCurrency()
                ),
                toVariants(entity),
                toSpecifications(entity),
                entity.getStockState(),
                entity.getPublishStatus(),
                entity.getFeatured(),
                entity.getShowOnHomepage(),
                toSeoMeta(
                        entity.getSeoTitle(),
                        entity.getSeoDescription(),
                        entity.getSeoCanonicalUrl(),
                        entity.getSeoOgImageId(),
                        entity.getSeoOgImageUrl(),
                        entity.getSeoOgImageAlt(),
                        entity.getSeoOgImageWidth(),
                        entity.getSeoOgImageHeight(),
                        entity.getSeoOgImageMimeType(),
                        entity.getSeoNoIndex()
                ),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }

    private Category toDomain(CategoryEntity entity) {
        return new Category(
                entity.getId(),
                entity.getSlug(),
                entity.getName(),
                entity.getDescription(),
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
                        entity.getSeoTitle(),
                        entity.getSeoDescription(),
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
                entity.getSortOrder(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }

    private Brand toDomain(BrandEntity entity) {
        return new Brand(
                entity.getId(),
                entity.getSlug(),
                entity.getName(),
                entity.getDescription(),
                toImageAsset(
                        entity.getLogoId(),
                        entity.getLogoUrl(),
                        entity.getLogoAlt(),
                        entity.getLogoWidth(),
                        entity.getLogoHeight(),
                        entity.getLogoMimeType()
                ),
                toSeoMeta(
                        entity.getSeoTitle(),
                        entity.getSeoDescription(),
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
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
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

    private List<ProductSpecification> toSpecifications(ProductEntity entity) {
        if (entity.getSpecifications() == null) {
            return List.of();
        }
        return entity.getSpecifications().stream()
                .sorted(SPEC_ORDER)
                .map(item -> new ProductSpecification(item.getName(), item.getValue(), item.getGroupName()))
                .toList();
    }

    private List<ProductVariant> toVariants(ProductEntity entity) {
        if (entity.getVariants() == null) {
            return List.of();
        }
        return entity.getVariants().stream()
                .sorted(VARIANT_ORDER)
                .map(this::toVariant)
                .toList();
    }

    private ProductVariant toVariant(ProductVariantEntity entity) {
        ProductPrice price = entity.getRetailPrice() == null
                ? null
                : new ProductPrice(
                        entity.getRetailPrice(),
                        entity.getCompareAtPrice(),
                        entity.getSalePrice(),
                        entity.getCurrency() == null ? "VND" : entity.getCurrency()
                );

        List<ProductVariantOption> options = entity.getOptions() == null
                ? List.of()
                : entity.getOptions().stream()
                        .sorted(VARIANT_OPTION_ORDER)
                        .map(option -> new ProductVariantOption(option.getOptionName(), option.getOptionValue()))
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
                entity.isAvailable()
        );
    }

    private CategorySummary toCategorySummary(CategoryEntity entity) {
        if (entity == null) {
            return null;
        }
        return new CategorySummary(entity.getId(), entity.getSlug(), entity.getName());
    }

    private BrandSummary toBrandSummary(BrandEntity entity) {
        if (entity == null) {
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
