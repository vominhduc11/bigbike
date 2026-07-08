package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.ProductImportRow;
import com.bigbike.bigbike_backend.api.admin.dto.ProductTranslationRequest;
import com.bigbike.bigbike_backend.api.admin.dto.SeoMetaRequest;
import com.bigbike.bigbike_backend.api.admin.dto.UpsertProductRequest;

/**
 * Converts the bulk import/export wire shape ({@link ProductImportRow}, each bilingual column
 * nested as one object e.g. {@code name: {nameVI, nameEN}}) to the shape the single-product admin
 * form already uses ({@link UpsertProductRequest} + {@link ProductTranslationRequest}), so the rest
 * of {@link ProductImportService}'s pipeline (validation, category/brand resolution, create/update)
 * never has to know about the nested-bilingual JSON shape.
 *
 * <p>Every setter on {@link UpsertProductRequest} backing a PATCH-style "Present" flag flips that
 * flag to {@code true} unconditionally, even when passed {@code null} (see e.g. {@code setSeo}).
 * So a column below is only ever touched here when its wrapper field is non-null — i.e. the key was
 * actually present in the file — never as a blind pass-through of a {@code null} sub-value.
 */
final class ProductImportRowMapper {

    private ProductImportRowMapper() {
    }

    static UpsertProductRequest toUpsertRequest(ProductImportRow row) {
        UpsertProductRequest request = new UpsertProductRequest();

        // sku/gender/retailPrice/salePrice back a PATCH "Present" flag that a null-valued call would
        // still flip to true (see class Javadoc) — only call the setter when the file actually sent
        // the key. categoryId/brandId/currency/publishStatus/forceOutOfStock/homepageBlock have no
        // such flag, but are guarded the same way for consistency and to match "absent = untouched".
        if (row.getSku() != null) {
            request.setSku(row.getSku());
        }
        if (row.getCategoryId() != null) {
            request.setCategoryId(row.getCategoryId());
        }
        if (row.getBrandId() != null) {
            request.setBrandId(row.getBrandId());
        }
        if (row.getGender() != null) {
            request.setGender(row.getGender());
        }
        if (row.getRetailPrice() != null) {
            request.setRetailPrice(row.getRetailPrice());
        }
        if (row.getSalePrice() != null) {
            request.setSalePrice(row.getSalePrice());
        }
        if (row.getCurrency() != null) {
            request.setCurrency(row.getCurrency());
        }
        if (row.getPublishStatus() != null) {
            request.setPublishStatus(row.getPublishStatus());
        }
        if (row.getForceOutOfStock() != null) {
            request.setForceOutOfStock(row.getForceOutOfStock());
        }
        if (row.getHomepageBlock() != null) {
            request.setHomepageBlock(row.getHomepageBlock());
        }
        if (row.getHomepageOrder() != null) {
            request.setHomepageOrder(row.getHomepageOrder());
        }
        if (row.getDescription() != null) {
            request.setDescription(row.getDescription());
        }
        if (row.getImage() != null) {
            request.setImage(row.getImage());
        }
        if (row.getGallery() != null) {
            request.setGallery(row.getGallery());
        }
        if (row.getVideos() != null) {
            request.setVideos(row.getVideos());
        }
        if (row.getFaqs() != null) {
            request.setFaqs(row.getFaqs());
        }
        if (row.getCommitments() != null) {
            request.setCommitments(row.getCommitments());
        }
        if (row.getHighlights() != null) {
            request.setHighlights(row.getHighlights());
        }
        if (row.getVariants() != null) {
            request.setVariants(row.getVariants());
        }
        if (row.getRelatedProductIds() != null) {
            request.setRelatedProductIds(row.getRelatedProductIds());
        }
        if (row.getAccessoryProductIds() != null) {
            request.setAccessoryProductIds(row.getAccessoryProductIds());
        }
        if (row.getDescriptionBlocks() != null) {
            request.setDescriptionBlocks(row.getDescriptionBlocks());
        }
        if (row.getSuitabilitySection() != null) {
            request.setSuitabilitySection(row.getSuitabilitySection());
        }
        if (row.getSizeGuideSection() != null) {
            request.setSizeGuideSection(row.getSizeGuideSection());
        }

        ProductTranslationRequest.ProductContentRequest en = new ProductTranslationRequest.ProductContentRequest();
        boolean hasEnglish = false;

        if (row.getName() != null) {
            if (row.getName().getNameVI() != null) {
                request.setName(row.getName().getNameVI());
            }
            if (row.getName().getNameEN() != null) {
                en.setName(row.getName().getNameEN());
                hasEnglish = true;
            }
        }
        if (row.getSlug() != null) {
            if (row.getSlug().getSlugVI() != null) {
                request.setSlug(row.getSlug().getSlugVI());
            }
            if (row.getSlug().getSlugEN() != null) {
                en.setSlug(row.getSlug().getSlugEN());
                hasEnglish = true;
            }
        }
        if (row.getShortDescription() != null) {
            if (row.getShortDescription().getShortDescriptionVI() != null) {
                request.setShortDescription(row.getShortDescription().getShortDescriptionVI());
            }
            if (row.getShortDescription().getShortDescriptionEN() != null) {
                en.setShortDescription(row.getShortDescription().getShortDescriptionEN());
                hasEnglish = true;
            }
        }
        if (row.getSpecificationsHtml() != null) {
            if (row.getSpecificationsHtml().getSpecificationsHtmlVI() != null) {
                request.setSpecificationsHtml(row.getSpecificationsHtml().getSpecificationsHtmlVI());
            }
            if (row.getSpecificationsHtml().getSpecificationsHtmlEN() != null) {
                en.setSpecificationsHtml(row.getSpecificationsHtml().getSpecificationsHtmlEN());
                hasEnglish = true;
            }
        }
        if (row.getSpecStatsHtml() != null) {
            if (row.getSpecStatsHtml().getSpecStatsHtmlVI() != null) {
                request.setSpecStatsHtml(row.getSpecStatsHtml().getSpecStatsHtmlVI());
            }
            if (row.getSpecStatsHtml().getSpecStatsHtmlEN() != null) {
                en.setSpecStatsHtml(row.getSpecStatsHtml().getSpecStatsHtmlEN());
                hasEnglish = true;
            }
        }
        if (row.getTrustBadgesHtml() != null) {
            if (row.getTrustBadgesHtml().getTrustBadgesHtmlVI() != null) {
                request.setTrustBadgesHtml(row.getTrustBadgesHtml().getTrustBadgesHtmlVI());
            }
            if (row.getTrustBadgesHtml().getTrustBadgesHtmlEN() != null) {
                en.setTrustBadgesHtml(row.getTrustBadgesHtml().getTrustBadgesHtmlEN());
                hasEnglish = true;
            }
        }
        if (row.getQuickAnswerSummary() != null) {
            if (row.getQuickAnswerSummary().getQuickAnswerSummaryVI() != null) {
                request.setQuickAnswerSummary(row.getQuickAnswerSummary().getQuickAnswerSummaryVI());
            }
            if (row.getQuickAnswerSummary().getQuickAnswerSummaryEN() != null) {
                en.setQuickAnswerSummary(row.getQuickAnswerSummary().getQuickAnswerSummaryEN());
                hasEnglish = true;
            }
        }
        if (row.getOriginBrandCountry() != null) {
            if (row.getOriginBrandCountry().getOriginBrandCountryVI() != null) {
                request.setOriginBrandCountry(row.getOriginBrandCountry().getOriginBrandCountryVI());
            }
            if (row.getOriginBrandCountry().getOriginBrandCountryEN() != null) {
                en.setOriginBrandCountry(row.getOriginBrandCountry().getOriginBrandCountryEN());
                hasEnglish = true;
            }
        }
        if (row.getSeo() != null) {
            ProductImportRow.SeoField seoField = row.getSeo();
            request.setSeo(SeoMetaRequest.builder()
                    .title(seoField.getTitleVI())
                    .description(seoField.getDescriptionVI())
                    .canonicalUrl(seoField.getCanonicalUrl())
                    .build());
            if (seoField.getTitleEN() != null) {
                en.setSeoTitle(seoField.getTitleEN());
                hasEnglish = true;
            }
            if (seoField.getDescriptionEN() != null) {
                en.setSeoDescription(seoField.getDescriptionEN());
                hasEnglish = true;
            }
        }

        if (hasEnglish) {
            request.setTranslations(new ProductTranslationRequest(en));
        }

        return request;
    }
}
