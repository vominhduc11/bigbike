package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.persistence.entity.catalog.AttributeEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.AttributeValueEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.BrandEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.CategoryEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantGalleryImageEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantOptionEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.json.JsonMapper;
import jakarta.persistence.EntityManager;
import java.io.IOException;
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.io.Writer;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVPrinter;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Streams one complete, lossless product row at a time; it deliberately has no report row cap. */
@Service
@RequiredArgsConstructor
public class FullProductCatalogCsvExportService {

    static final int PAGE_SIZE = 100;
    static final List<String> HEADERS = List.of(
            "id", "legacy_id", "sku", "slug", "slug_en", "name_vi", "name_en", "short_description_vi", "short_description_en", "description_vi", "description_en",
            "category_ids", "category_slugs", "category_names_vi", "category_names_en", "brand_id", "brand_slug", "brand_name",
            "image_id", "image_url", "image_alt", "image_width", "image_height", "image_mime_type", "retail_price", "sale_price", "currency", "stock_state", "stock_quantity", "manage_stock", "backorders", "length_cm", "width_cm", "height_cm", "available", "discount_percent_override", "publish_status", "homepage_block", "homepage_order", "rating", "rating_count", "pdp_shipping_line", "pdp_return_line", "origin_brand_country_vi", "origin_brand_country_en", "size_guide_vi", "size_guide_en", "suitability_advisory_vi", "suitability_advisory_en", "specifications_vi", "specifications_en", "spec_stats_vi", "spec_stats_en", "trust_badges_vi", "trust_badges_en", "quick_answer_summary_vi", "quick_answer_summary_en", "gender", "seo_title_vi", "seo_title_en", "seo_description_vi", "seo_description_en", "seo_canonical_url", "seo_og_image_id", "seo_og_image_url", "seo_og_image_alt", "seo_og_image_width", "seo_og_image_height", "seo_og_image_mime_type", "created_at", "updated_at", "version", "description_blocks_json", "suitability_section_json", "size_guide_section_json", "faqs_json", "commitments_json", "highlights_json", "gallery_json", "videos_json", "variants_json", "related_products_json", "accessory_products_json"
    );

    private static final ObjectMapper JSON = JsonMapper.builder().findAndAddModules().build();
    private final ProductJpaRepository productRepository;
    private final EntityManager entityManager;

    @Transactional(readOnly = true)
    public void writeTo(OutputStream outputStream) throws IOException {
        try (Writer writer = new OutputStreamWriter(outputStream, StandardCharsets.UTF_8);
             CSVPrinter printer = new CSVPrinter(writer, CSVFormat.DEFAULT)) {
            writer.write('\uFEFF');
            printer.printRecord(HEADERS);
            String afterId = null;
            while (true) {
                List<ProductEntity> products = productRepository.findForFullCsvExportAfterId(afterId, PageRequest.of(0, PAGE_SIZE));
                if (products.isEmpty()) break;
                for (ProductEntity product : products) printer.printRecord(row(product));
                afterId = products.get(products.size() - 1).getId();
                entityManager.clear();
            }
            printer.flush();
        }
    }

    private List<String> row(ProductEntity p) {
        List<CategoryEntity> categories = p.getCategories() == null ? List.of() : p.getCategories();
        BrandEntity brand = p.getBrand();
        return Arrays.asList(
                value(p.getId()), value(p.getLegacyId()), value(p.getSku()), value(p.getSlug()), value(p.getSlugEn()), value(p.getName()), value(p.getNameEn()), value(p.getShortDescription()), value(p.getShortDescriptionEn()), value(p.getDescription()), value(p.getDescriptionEn()),
                categoryValue(categories, CategoryEntity::getId), categoryValue(categories, CategoryEntity::getSlug), categoryValue(categories, CategoryEntity::getName), categoryValue(categories, CategoryEntity::getNameEn), value(brand == null ? null : brand.getId()), value(brand == null ? null : brand.getSlug()), value(brand == null ? null : brand.getName()),
                value(p.getImageId()), value(p.getImageUrl()), value(p.getImageAlt()), value(p.getImageWidth()), value(p.getImageHeight()), value(p.getImageMimeType()), value(p.getRetailPrice()), value(p.getSalePrice()), value(p.getCurrency()), value(enumValue(p.getStockState())), value(p.getStockQuantity()), value(p.getManageStock()), value(p.getBackorders()), value(p.getLengthCm()), value(p.getWidthCm()), value(p.getHeightCm()), value(p.getAvailable()), value(p.getDiscountPercentOverride()), value(enumValue(p.getPublishStatus())), value(enumValue(p.getHomepageBlock())), value(p.getHomepageOrder()), value(p.getRating()), value(p.getRatingCount()), value(p.getPdpShippingLine()), value(p.getPdpReturnLine()), value(p.getOriginBrandCountry()), value(p.getOriginBrandCountryEn()), value(p.getSizeGuide()), value(p.getSizeGuideEn()), value(p.getSuitabilityAdvisory()), value(p.getSuitabilityAdvisoryEn()), value(p.getSpecifications()), value(p.getSpecificationsEn()), value(p.getSpecStats()), value(p.getSpecStatsEn()), value(p.getTrustBadges()), value(p.getTrustBadgesEn()), value(p.getQuickAnswerSummary()), value(p.getQuickAnswerSummaryEn()), value(p.getGender()), value(p.getSeoTitle()), value(p.getSeoTitleEn()), value(p.getSeoDescription()), value(p.getSeoDescriptionEn()), value(p.getSeoCanonicalUrl()), value(p.getSeoOgImageId()), value(p.getSeoOgImageUrl()), value(p.getSeoOgImageAlt()), value(p.getSeoOgImageWidth()), value(p.getSeoOgImageHeight()), value(p.getSeoOgImageMimeType()), value(timestamp(p.getCreatedAt())), value(timestamp(p.getUpdatedAt())), value(p.getVersion()), json(p.getDescriptionBlocks()), json(p.getSuitabilitySection()), json(p.getSizeGuideSection()), json(p.getFaqs()), json(p.getCommitments()), json(p.getHighlights()), json(p.getGallery()), json(p.getVideos()), json(variants(p.getVariants())), json(linkedProducts(p.getRelatedProducts())), json(linkedProducts(p.getAccessoryProducts()))
        );
    }

    private static String categoryValue(List<CategoryEntity> categories, java.util.function.Function<CategoryEntity, String> field) {
        return categories.stream().map(field).filter(java.util.Objects::nonNull).collect(java.util.stream.Collectors.joining("|"));
    }

    private List<Map<String, Object>> variants(Collection<ProductVariantEntity> variants) {
        List<Map<String, Object>> result = new ArrayList<>();
        if (variants == null) return result;
        for (ProductVariantEntity variant : variants) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", variant.getId()); row.put("sku", variant.getSku()); row.put("name", variant.getName());
            row.put("retailPrice", variant.getRetailPrice()); row.put("salePrice", variant.getSalePrice()); row.put("currency", variant.getCurrency());
            row.put("stockState", enumValue(variant.getStockState())); row.put("quantityOnHand", variant.getQuantityOnHand()); row.put("isAvailable", variant.isAvailable()); row.put("sortOrder", variant.getSortOrder());
            row.put("image", image(variant.getImageId(), variant.getImageUrl(), variant.getImageAlt(), variant.getImageWidth(), variant.getImageHeight(), variant.getImageMimeType()));
            row.put("options", variantOptions(variant.getOptions())); row.put("gallery", variantGallery(variant.getGallery())); result.add(row);
        }
        return result;
    }

    private List<Map<String, Object>> variantOptions(Collection<ProductVariantOptionEntity> options) {
        List<Map<String, Object>> result = new ArrayList<>();
        if (options == null) return result;
        for (ProductVariantOptionEntity option : options) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", option.getId()); row.put("sortOrder", option.getSortOrder()); row.put("optionName", option.getOptionName()); row.put("optionValue", option.getOptionValue());
            row.put("attribute", attribute(option.getAttribute())); row.put("attributeValue", attributeValue(option.getAttributeValue())); result.add(row);
        }
        return result;
    }

    private List<Map<String, Object>> variantGallery(Collection<ProductVariantGalleryImageEntity> gallery) {
        List<Map<String, Object>> result = new ArrayList<>();
        if (gallery == null) return result;
        for (ProductVariantGalleryImageEntity item : gallery) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", item.getId()); row.put("sortOrder", item.getSortOrder()); row.put("mediaType", item.getMediaType()); row.put("videoUrl", item.getVideoUrl()); row.put("videoProvider", item.getVideoProvider());
            row.put("image", image(item.getImageId(), item.getImageUrl(), item.getImageAlt(), item.getImageWidth(), item.getImageHeight(), item.getImageMimeType())); result.add(row);
        }
        return result;
    }

    private List<Map<String, Object>> linkedProducts(Collection<ProductEntity> products) {
        List<Map<String, Object>> result = new ArrayList<>();
        if (products == null) return result;
        for (ProductEntity product : products) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", product.getId()); row.put("legacyId", product.getLegacyId()); row.put("sku", product.getSku()); row.put("slug", product.getSlug()); row.put("slugEn", product.getSlugEn()); row.put("name", product.getName()); row.put("nameEn", product.getNameEn());
            row.put("image", image(product.getImageId(), product.getImageUrl(), product.getImageAlt(), product.getImageWidth(), product.getImageHeight(), product.getImageMimeType())); row.put("retailPrice", product.getRetailPrice()); row.put("salePrice", product.getSalePrice()); row.put("currency", product.getCurrency()); row.put("stockState", enumValue(product.getStockState())); row.put("publishStatus", enumValue(product.getPublishStatus())); row.put("homepageBlock", enumValue(product.getHomepageBlock())); result.add(row);
        }
        return result;
    }

    private static Map<String, Object> image(String id, String url, String alt, Integer width, Integer height, String mimeType) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", id); result.put("url", url); result.put("alt", alt); result.put("width", width); result.put("height", height); result.put("mimeType", mimeType); return result;
    }

    private static Map<String, Object> attribute(AttributeEntity value) {
        if (value == null) return null;
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", value.getId()); result.put("code", value.getCode()); result.put("name", value.getName()); result.put("nameEn", value.getNameEn()); result.put("kind", value.getKind()); result.put("variation", value.isVariation()); result.put("legacyTaxonomyId", value.getLegacyTaxonomyId()); return result;
    }

    private static Map<String, Object> attributeValue(AttributeValueEntity value) {
        if (value == null) return null;
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", value.getId()); result.put("slug", value.getSlug()); result.put("label", value.getLabel()); result.put("labelEn", value.getLabelEn()); result.put("legacyTermId", value.getLegacyTermId()); result.put("sortOrder", value.getSortOrder()); return result;
    }

    private static String value(Object raw) {
        if (raw == null) return "";
        return CsvExportUtil.escape(raw instanceof BigDecimal decimal ? decimal.toPlainString() : String.valueOf(raw));
    }

    private static String enumValue(Enum<?> value) { return value == null ? null : value.name(); }
    private static String timestamp(Instant instant) { return instant == null ? null : DateTimeFormatter.ISO_INSTANT.format(instant); }

    private static String json(Object value) {
        try {
            return CsvExportUtil.escape(JSON.writeValueAsString(value == null ? List.of() : value));
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Failed to serialize full product CSV data.", exception);
        }
    }
}
