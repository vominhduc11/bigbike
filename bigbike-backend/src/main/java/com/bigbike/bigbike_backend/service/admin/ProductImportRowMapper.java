package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.ProductImportRow;
import com.bigbike.bigbike_backend.api.admin.dto.ProductTranslationRequest;
import com.bigbike.bigbike_backend.api.admin.dto.SeoMetaRequest;
import com.bigbike.bigbike_backend.api.admin.dto.UpsertProductRequest;
import com.bigbike.bigbike_backend.domain.catalog.ProductGenderSupport;

/**
 * Converts the bulk import / single-product export wire shape ({@link ProductImportRow}, each bilingual column
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
        // the key. categoryId/brandId/currency/publishStatus/available/homepageBlock have no
        // such flag, but are guarded the same way for consistency and to match "absent = untouched".
        if (row.getSku() != null) {
            request.setSku(row.getSku());
        }
        if (row.getCategorySlugs() != null) {
            request.setCategoryIds(row.getCategorySlugs());
        } else if (row.getCategoryIds() != null) {
            request.setCategoryIds(row.getCategoryIds());
        } else if (row.getCategoryId() != null) {
            request.setCategoryId(row.getCategoryId());
        }
        if (row.getBrandId() != null) {
            request.setBrandId(row.getBrandId());
        }
        if (row.getGenders() != null) {
            request.setGenders(row.getGenders());
        } else if (row.getGender() != null) {
            // Legacy scalar files remain readable. Known values are promoted to the
            // canonical array immediately; Unisex becomes the valid empty state.
            try {
                request.setGenders(ProductGenderSupport.fromLegacy(row.getGender()));
            } catch (IllegalArgumentException ex) {
                // Preserve the old value so the shared request validator can return
                // the normal field-level import error for unknown legacy values.
                request.setGender(row.getGender());
            }
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
        if (row.getAvailable() != null) {
            request.setAvailable(row.getAvailable());
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
        // PRODUCT_RULE_009 (owner decision 2026-08-08): `variants` is deliberately NOT copied onto the
        // upsert request. Bulk import never creates/updates/removes variants — leaving the request's
        // variants null makes ProductMutationService.applyVariants a no-op, so an UPDATE row keeps the
        // product's existing variants untouched and a CREATE row lands with none. Variants are managed
        // in Admin only (ProductDetailScreen "Biến thể"). The field still exists on ProductImportRow
        // for single-product export and so older files carrying it stay readable — ProductImportService
        // .parseJson flags such a row with a warning instead of silently dropping it.
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
        if (row.getSpecifications() != null) {
            if (row.getSpecifications().getSpecificationsVI() != null) {
                request.setSpecifications(row.getSpecifications().getSpecificationsVI());
            }
            if (row.getSpecifications().getSpecificationsEN() != null) {
                en.setSpecifications(row.getSpecifications().getSpecificationsEN());
                hasEnglish = true;
            }
        }
        if (row.getSpecStats() != null) {
            if (row.getSpecStats().getSpecStatsVI() != null) {
                request.setSpecStats(row.getSpecStats().getSpecStatsVI());
            }
            if (row.getSpecStats().getSpecStatsEN() != null) {
                en.setSpecStats(row.getSpecStats().getSpecStatsEN());
                hasEnglish = true;
            }
        }
        if (row.getTrustBadges() != null) {
            if (row.getTrustBadges().getTrustBadgesVI() != null) {
                request.setTrustBadges(row.getTrustBadges().getTrustBadgesVI());
            }
            if (row.getTrustBadges().getTrustBadgesEN() != null) {
                en.setTrustBadges(row.getTrustBadges().getTrustBadgesEN());
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
