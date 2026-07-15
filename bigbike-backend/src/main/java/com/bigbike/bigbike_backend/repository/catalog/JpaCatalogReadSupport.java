package com.bigbike.bigbike_backend.repository.catalog;

import com.bigbike.bigbike_backend.domain.catalog.BrandTranslations;
import com.bigbike.bigbike_backend.domain.catalog.CategoryTranslations;
import com.bigbike.bigbike_backend.domain.catalog.DescriptionBlock;
import com.bigbike.bigbike_backend.domain.catalog.GalleryMedia;
import com.bigbike.bigbike_backend.domain.catalog.ImageAsset;
import com.bigbike.bigbike_backend.domain.catalog.ProductTranslations;
import com.bigbike.bigbike_backend.domain.catalog.ProductVariant;
import com.bigbike.bigbike_backend.domain.catalog.ProductVariantOption;
import com.bigbike.bigbike_backend.domain.catalog.SeoMeta;
import com.bigbike.bigbike_backend.domain.catalog.SizeGuideSection;
import com.bigbike.bigbike_backend.domain.catalog.SuitabilitySection;
import com.bigbike.bigbike_backend.persistence.entity.catalog.BrandEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.CategoryEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import java.text.Normalizer;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Pure stateless row/entity → domain mapping + normalization helpers extracted
 * from {@link JpaCatalogReadRepository}. These use no Spring beans, no
 * EntityManager, and no instance state — they are static so the repository can
 * import them via {@code import static ...JpaCatalogReadSupport.*} and keep its
 * call sites unchanged. Follows the {@code ProductFieldApplier} precedent
 * (package-private final class of {@code public static} helpers, private ctor,
 * no Spring annotation).
 */
final class JpaCatalogReadSupport {

    private JpaCatalogReadSupport() {}

    private static final Set<String> COLOR_ATTRIBUTE_KEYS = Set.of(
            "color", "colour", "mau", "mau sac", "pa color", "pa mau", "pa mau sac"
    );

    private static final String LOCALE_EN = "en";

    /**
     * Resolve one translatable field for the requested locale. English content
     * falls back to Vietnamese field-by-field when the {@code _en} column is
     * blank (see {@code BUSINESS_RULES.md PRODUCT_RULE_002}).
     */
    static String pick(String base, String en, String locale) {
        if (LOCALE_EN.equals(locale) && en != null && !en.isBlank()) {
            return en;
        }
        return base;
    }

    /**
     * Locale-resolve a bilingual-inline description block list (V326) for PUBLIC reads. Delegates to
     * {@link DescriptionBlock#resolveForLocale} (shared with the write-side EN HTML rendering in
     * {@code AdminCatalogMutationService}) — resolved value in the base field, {@code *En} nulled
     * out, same convention as {@code toFaqs}/{@code toCommitments}/{@code toHighlights}. Admin reads
     * should use the raw block list from the entity directly instead, since both languages already
     * live inline on each block.
     */
    static List<DescriptionBlock> resolveDescriptionBlocksForPublic(List<DescriptionBlock> blocks, String locale) {
        return DescriptionBlock.resolveForLocale(blocks, locale);
    }

    /** Same convention as {@link #resolveDescriptionBlocksForPublic} but for the standalone "Phù hợp với ai" field (V327/V328). */
    static SuitabilitySection resolveSuitabilitySectionForPublic(SuitabilitySection section, String locale) {
        return SuitabilitySection.resolveForLocale(section, locale);
    }

    /** Same convention as {@link #resolveDescriptionBlocksForPublic} but for the standalone "Bảng size" field (V327/V328). */
    static SizeGuideSection resolveSizeGuideSectionForPublic(SizeGuideSection section, String locale) {
        return SizeGuideSection.resolveForLocale(section, locale);
    }

    static CategoryTranslations toCategoryTranslations(CategoryEntity entity) {
        boolean anyEnglish = isPresent(entity.getNameEn())
                || isPresent(entity.getDescriptionEn())
                || isPresent(entity.getSeoTitleEn())
                || isPresent(entity.getSeoDescriptionEn())
                || isPresent(entity.getIntroContentEn());
        if (!anyEnglish) return null;
        return new CategoryTranslations(new CategoryTranslations.CategoryContent(
                entity.getNameEn(),
                entity.getDescriptionEn(),
                entity.getSeoTitleEn(),
                entity.getSeoDescriptionEn(),
                entity.getIntroContentEn()
        ));
    }

    static BrandTranslations toBrandTranslations(BrandEntity entity) {
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

    /**
     * Raw English product-level content for admin detail reads. Returns
     * {@code null} when no English content exists at all, so the public response
     * shape is unchanged and the admin editor can detect "no translation yet".
     */
    static ProductTranslations toTranslations(ProductEntity entity) {
        boolean anyEnglish = isPresent(entity.getNameEn())
                || isPresent(entity.getShortDescriptionEn())
                || isPresent(entity.getDescriptionEn())
                || isPresent(entity.getSuitabilityAdvisoryEn())
                || isPresent(entity.getSpecificationsEn())
                || isPresent(entity.getSpecStatsEn())
                || isPresent(entity.getTrustBadgesEn())
                || isPresent(entity.getQuickAnswerSummaryEn())
                || isPresent(entity.getSeoTitleEn())
                || isPresent(entity.getSeoDescriptionEn())
                || isPresent(entity.getOriginBrandCountryEn())
                || hasAnyBlockTranslation(entity.getDescriptionBlocks())
                || hasSuitabilitySectionTranslation(entity.getSuitabilitySection())
                || hasSizeGuideSectionTranslation(entity.getSizeGuideSection());
        if (!anyEnglish) {
            return null;
        }
        return new ProductTranslations(new ProductTranslations.ProductContent(
                entity.getNameEn(),
                entity.getShortDescriptionEn(),
                entity.getDescriptionEn(),
                entity.getSuitabilityAdvisoryEn(),
                entity.getSpecificationsEn(),
                entity.getSpecStatsEn(),
                entity.getTrustBadgesEn(),
                entity.getQuickAnswerSummaryEn(),
                entity.getSeoTitleEn(),
                entity.getSeoDescriptionEn(),
                entity.getOriginBrandCountryEn()
        ));
    }

    /** True if any block carries non-blank English content in any of its {@code *En} fields. */
    private static boolean hasAnyBlockTranslation(List<DescriptionBlock> blocks) {
        if (blocks == null) return false;
        for (DescriptionBlock block : blocks) {
            if (block instanceof DescriptionBlock.HeadingBlock b && isPresent(b.getTextEn())) return true;
            if (block instanceof DescriptionBlock.ParagraphBlock b && isPresent(b.getHtmlEn())) return true;
            if (block instanceof DescriptionBlock.ListBlock b && b.getItemsEn() != null && !b.getItemsEn().isEmpty()) return true;
            if (block instanceof DescriptionBlock.ImageBlock b && (isPresent(b.getAltEn()) || isPresent(b.getCaptionEn()))) return true;
            if (block instanceof DescriptionBlock.VideoBlock b && isPresent(b.getCaptionEn())) return true;
            if (block instanceof DescriptionBlock.CalloutBlock b && isPresent(b.getHtmlEn())) return true;
            if (block instanceof DescriptionBlock.FeatureBlock b && (isPresent(b.getAltEn()) || isPresent(b.getCaptionEn())
                    || isPresent(b.getSubheadingEn()) || isPresent(b.getHeadingEn()) || isPresent(b.getHtmlEn())
                    || (b.getItemsEn() != null && !b.getItemsEn().isEmpty()))) return true;
        }
        return false;
    }

    /** True if the standalone "Phù hợp với ai" field (V327/V328) carries any non-blank English content. */
    private static boolean hasSuitabilitySectionTranslation(SuitabilitySection section) {
        if (section == null) return false;
        return isPresent(section.getTitleEn()) || isPresent(section.getHtmlEn());
    }

    /** True if the standalone "Bảng size" field (V327/V328) carries any non-blank English content. */
    private static boolean hasSizeGuideSectionTranslation(SizeGuideSection section) {
        return section != null && (isPresent(section.getTitleEn()) || isPresent(section.getHtmlEn()));
    }

    static boolean isPresent(String value) {
        return value != null && !value.isBlank();
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
    static List<ProductVariant> withColorScopedVariantMedia(List<ProductVariant> variants) {
        Map<String, List<GalleryMedia>> galleryByColor = new HashMap<>();
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
                    List<GalleryMedia> gallery = colorKey == null
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
                            image,
                            gallery,
                            variant.isAvailable()
                    );
                })
                .toList();
    }

    static String variantColorKey(ProductVariant variant) {
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

    static boolean isColorAttributeName(String name) {
        return COLOR_ATTRIBUTE_KEYS.contains(normalizeVariantToken(name));
    }

    static String normalizeVariantToken(String raw) {
        if (raw == null || raw.isBlank()) return "";
        return Normalizer.normalize(raw.trim(), Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .replace('\u0110', 'D')
                .replace('\u0111', 'd')
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", " ")
                .trim();
    }

    /** Returns the first non-blank value, or empty string if neither has content. */
    static String preferLabel(String preferred, String fallback) {
        if (preferred != null && !preferred.isBlank()) return preferred;
        if (fallback != null && !fallback.isBlank()) return fallback;
        return "";
    }

    static ImageAsset toImageAsset(
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

    static SeoMeta toSeoMeta(
            String title,
            String description,
            String canonicalUrl,
            String ogImageId,
            String ogImageUrl,
            String ogImageAlt,
            Integer ogImageWidth,
            Integer ogImageHeight,
            String ogImageMimeType
    ) {
        if ((title == null || title.isBlank())
                && (description == null || description.isBlank())
                && (canonicalUrl == null || canonicalUrl.isBlank())
                && (ogImageUrl == null || ogImageUrl.isBlank())) {
            return null;
        }

        return new SeoMeta(
                title,
                description,
                canonicalUrl,
                toImageAsset(ogImageId, ogImageUrl, ogImageAlt, ogImageWidth, ogImageHeight, ogImageMimeType),
                false   // noIndex — catalog entities (product/brand/category) don't expose per-entity noindex
        );
    }
}
