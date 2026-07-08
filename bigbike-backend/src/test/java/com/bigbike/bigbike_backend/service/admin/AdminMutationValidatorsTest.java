package com.bigbike.bigbike_backend.service.admin;

import static org.assertj.core.api.Assertions.assertThat;

import com.bigbike.bigbike_backend.api.admin.dto.ImageAssetRequest;
import com.bigbike.bigbike_backend.api.admin.dto.SeoMetaRequest;
import com.bigbike.bigbike_backend.api.common.ApiErrorDetail;
import com.bigbike.bigbike_backend.persistence.entity.catalog.BrandEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.CategoryEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantEntity;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;

class AdminMutationValidatorsTest {

    private static final String MINIO_BASE_URL = "http://localhost:9000/bigbike-media";

    @Test
    void imageUrlUnderConfiguredMinioBaseUrlIsAccepted() {
        List<ApiErrorDetail> errors = new ArrayList<>();

        AdminMutationValidators.validateImageAsset(
                image("http://localhost:9000/bigbike-media/wp-uploads/2024/05/xe-may-honda.jpg"),
                "image",
                MINIO_BASE_URL,
                errors
        );

        assertThat(errors).isEmpty();
    }

    @Test
    void imageUrlOutsideConfiguredMinioBaseUrlIsRejected() {
        List<ApiErrorDetail> errors = new ArrayList<>();

        AdminMutationValidators.validateImageAsset(
                image("https://cdn.bigbike.vn/uploads/xe-may-honda.jpg"),
                "image",
                MINIO_BASE_URL,
                errors
        );

        assertThat(errors)
                .hasSize(1)
                .first()
                .satisfies(error -> {
                    assertThat(error.field()).isEqualTo("image.url");
                    assertThat(error.code()).isEqualTo("INVALID_VALUE");
                });
    }

    @Test
    void seoCanonicalUrlCanRemainPublicWhileOgImageIsWhitelisted() {
        List<ApiErrorDetail> errors = new ArrayList<>();
        SeoMetaRequest seo = new SeoMetaRequest();
        seo.setCanonicalUrl("https://bigbike.vn/product/mu-bao-hiem-ls2-ff800/");
        seo.setOgImage(image("http://localhost:9000/bigbike-media/wp-uploads/2024/05/xe-may-honda.jpg"));

        AdminMutationValidators.validateSeoMeta(seo, "seo", MINIO_BASE_URL, errors);

        assertThat(errors).isEmpty();
    }

    @Test
    void seoOgImageOutsideConfiguredMinioBaseUrlIsRejected() {
        List<ApiErrorDetail> errors = new ArrayList<>();
        SeoMetaRequest seo = new SeoMetaRequest();
        seo.setCanonicalUrl("https://bigbike.vn/product/mu-bao-hiem-ls2-ff800/");
        seo.setOgImage(image("https://example.com/og.jpg"));

        AdminMutationValidators.validateSeoMeta(seo, "seo", MINIO_BASE_URL, errors);

        assertThat(errors)
                .hasSize(1)
                .first()
                .satisfies(error -> {
                    assertThat(error.field()).isEqualTo("seo.ogImage.url");
                    assertThat(error.code()).isEqualTo("INVALID_VALUE");
                });
    }

    @Test
    void mediaUrlMustRespectPathBoundary() {
        List<ApiErrorDetail> errors = new ArrayList<>();

        AdminMutationValidators.validateImageAsset(
                image("http://localhost:9000/bigbike-media-malicious/xe.jpg"),
                "image",
                MINIO_BASE_URL,
                errors
        );

        assertThat(errors).hasSize(1);
        assertThat(errors.get(0).field()).isEqualTo("image.url");
    }

    @Test
    void validatePublishTransition_allowsValidTransitions() {
        List<ApiErrorDetail> errors = new ArrayList<>();
        AdminMutationValidators.validatePublishTransition(com.bigbike.bigbike_backend.domain.catalog.PublishStatus.DRAFT, com.bigbike.bigbike_backend.domain.catalog.PublishStatus.PUBLISHED, "publishStatus", errors);
        assertThat(errors).isEmpty();
    }

    @Test
    void validatePublishTransition_allowsPublishedToDraftDirectly() {
        List<ApiErrorDetail> errors = new ArrayList<>();
        AdminMutationValidators.validatePublishTransition(com.bigbike.bigbike_backend.domain.catalog.PublishStatus.PUBLISHED, com.bigbike.bigbike_backend.domain.catalog.PublishStatus.DRAFT, "publishStatus", errors);
        assertThat(errors).isEmpty();
    }

    @Test
    void validatePublishTransition_rejectsInvalidTransitions() {
        List<ApiErrorDetail> errors = new ArrayList<>();
        AdminMutationValidators.validatePublishTransition(com.bigbike.bigbike_backend.domain.catalog.PublishStatus.TRASH, com.bigbike.bigbike_backend.domain.catalog.PublishStatus.PUBLISHED, "publishStatus", errors);
        assertThat(errors).hasSize(1);
        assertThat(errors.get(0).code()).isEqualTo("INVALID_STATE_TRANSITION");
    }

    @Test
    void validatePublishTransition_rejectsReservedStatuses() {
        List<ApiErrorDetail> errors = new ArrayList<>();
        AdminMutationValidators.validatePublishTransition(com.bigbike.bigbike_backend.domain.catalog.PublishStatus.DRAFT, com.bigbike.bigbike_backend.domain.catalog.PublishStatus.ARCHIVED, "publishStatus", errors);
        assertThat(errors).hasSize(1);
        assertThat(errors.get(0).code()).isEqualTo("RESERVED_PUBLISH_STATUS");
    }

    @Test
    void validatePublishTransition_rejectsHiddenAsReservedTarget() {
        List<ApiErrorDetail> errors = new ArrayList<>();
        AdminMutationValidators.validatePublishTransition(com.bigbike.bigbike_backend.domain.catalog.PublishStatus.DRAFT, com.bigbike.bigbike_backend.domain.catalog.PublishStatus.HIDDEN, "publishStatus", errors);
        assertThat(errors).hasSize(1);
        assertThat(errors.get(0).code()).isEqualTo("RESERVED_PUBLISH_STATUS");
    }

    @Test
    void validatePublishTransition_legacySourceEscapesOnlyToDraftOrTrash() {
        com.bigbike.bigbike_backend.domain.catalog.PublishStatus hidden =
                com.bigbike.bigbike_backend.domain.catalog.PublishStatus.HIDDEN;

        List<ApiErrorDetail> toDraft = new ArrayList<>();
        AdminMutationValidators.validatePublishTransition(hidden, com.bigbike.bigbike_backend.domain.catalog.PublishStatus.DRAFT, "publishStatus", toDraft);
        assertThat(toDraft).isEmpty();

        List<ApiErrorDetail> toTrash = new ArrayList<>();
        AdminMutationValidators.validatePublishTransition(hidden, com.bigbike.bigbike_backend.domain.catalog.PublishStatus.TRASH, "publishStatus", toTrash);
        assertThat(toTrash).isEmpty();

        List<ApiErrorDetail> toPublished = new ArrayList<>();
        AdminMutationValidators.validatePublishTransition(hidden, com.bigbike.bigbike_backend.domain.catalog.PublishStatus.PUBLISHED, "publishStatus", toPublished);
        assertThat(toPublished).hasSize(1);
        assertThat(toPublished.get(0).code()).isEqualTo("INVALID_STATE_TRANSITION");
    }

    // PRODUCT_RULE_005 — validateProductFieldsRequired: the required-field matrix, branched on
    // has-variants and on requireImages (draft vs publish). Bare entity with nothing set.

    @Test
    void validateProductFieldsRequired_noVariants_draft_flagsCoreFieldsButNotImage() {
        ProductEntity entity = new ProductEntity();
        List<ApiErrorDetail> errors = new ArrayList<>();

        AdminMutationValidators.validateProductFieldsRequired(entity, false, errors);

        assertThat(fields(errors)).containsExactlyInAnyOrder(
                "name", "slug", "categoryId", "brandId", "gender", "sku", "retailPrice");
    }

    @Test
    void validateProductFieldsRequired_noVariants_publish_alsoRequiresImage() {
        ProductEntity entity = new ProductEntity();
        List<ApiErrorDetail> errors = new ArrayList<>();

        AdminMutationValidators.validateProductFieldsRequired(entity, true, errors);

        assertThat(fields(errors)).containsExactlyInAnyOrder(
                "name", "slug", "categoryId", "brandId", "gender", "sku", "retailPrice", "imageUrl");
    }

    @Test
    void validateProductFieldsRequired_noVariants_complete_draftPasses() {
        ProductEntity entity = completeCoreEntity();
        List<ApiErrorDetail> errors = new ArrayList<>();

        AdminMutationValidators.validateProductFieldsRequired(entity, false, errors);

        assertThat(errors).isEmpty();
    }

    @Test
    void validateProductFieldsRequired_noVariants_complete_publishStillRequiresImage() {
        ProductEntity entity = completeCoreEntity();
        List<ApiErrorDetail> errors = new ArrayList<>();

        AdminMutationValidators.validateProductFieldsRequired(entity, true, errors);

        assertThat(fields(errors)).containsExactly("imageUrl");
    }

    @Test
    void validateProductFieldsRequired_hasVariants_productSkuAndPriceNotRequired() {
        ProductEntity entity = completeCoreEntity();
        entity.setSku(null);
        entity.setRetailPrice(null);
        entity.setVariants(List.of(completeVariant()));
        List<ApiErrorDetail> errors = new ArrayList<>();

        AdminMutationValidators.validateProductFieldsRequired(entity, false, errors);

        assertThat(errors).isEmpty();
    }

    @Test
    void validateProductFieldsRequired_hasVariants_draft_flagsMissingVariantSkuAndPriceButNotImage() {
        ProductEntity entity = completeCoreEntity();
        entity.setSku(null);
        entity.setRetailPrice(null);
        ProductVariantEntity variant = new ProductVariantEntity();
        variant.setId("var_1");
        entity.setVariants(List.of(variant));
        List<ApiErrorDetail> errors = new ArrayList<>();

        AdminMutationValidators.validateProductFieldsRequired(entity, false, errors);

        assertThat(fields(errors)).containsExactlyInAnyOrder(
                "variants[0].sku", "variants[0].retailPrice");
    }

    @Test
    void validateProductFieldsRequired_hasVariants_productHasSharedPrice_variantRetailPriceNotRequired() {
        // PRODUCT_RULE_013 (2026-07-07) — a variant without its own retailPrice falls back to the
        // product's shared retailPrice (completeCoreEntity() already has one), so only its missing
        // SKU should be flagged, not its retailPrice.
        ProductEntity entity = completeCoreEntity();
        ProductVariantEntity variant = new ProductVariantEntity();
        variant.setId("var_1");
        entity.setVariants(List.of(variant));
        List<ApiErrorDetail> errors = new ArrayList<>();

        AdminMutationValidators.validateProductFieldsRequired(entity, false, errors);

        assertThat(fields(errors)).containsExactly("variants[0].sku");
    }

    @Test
    void validateProductFieldsRequired_variantSalePriceWithoutOwnRetailPrice_isRejected() {
        // A variant with no retailPrice of its own is not "self-priced" (VariantPricing.
        // hasOwnPrice) — a salePrice submitted alone would be silently ignored, so it's rejected.
        ProductEntity entity = completeCoreEntity(); // has a shared retailPrice
        ProductVariantEntity variant = new ProductVariantEntity();
        variant.setId("var_1");
        variant.setSku("LS2-FF800-RED-M");
        variant.setSalePrice(BigDecimal.ONE);
        entity.setVariants(List.of(variant));
        List<ApiErrorDetail> errors = new ArrayList<>();

        AdminMutationValidators.validateProductFieldsRequired(entity, false, errors);

        assertThat(fields(errors)).containsExactly("variants[0].salePrice");
    }

    @Test
    void validateProductFieldsRequired_hasVariants_publish_requiresVariantImageToo() {
        ProductEntity entity = completeCoreEntity();
        entity.setSku(null);
        entity.setRetailPrice(null);
        entity.setImageUrl("http://localhost:9000/bigbike-media/products/ls2-ff800/main.jpg");
        ProductVariantEntity variant = completeVariant();
        variant.setImageUrl(null);
        entity.setVariants(List.of(variant));
        List<ApiErrorDetail> errors = new ArrayList<>();

        AdminMutationValidators.validateProductFieldsRequired(entity, true, errors);

        assertThat(fields(errors)).containsExactly("variants[0].imageUrl");
    }

    @Test
    void validatePublishReadiness_delegatesWithRequireImagesTrue() {
        ProductEntity entity = completeCoreEntity();
        List<ApiErrorDetail> errors = new ArrayList<>();

        AdminMutationValidators.validatePublishReadiness(entity, errors);

        assertThat(fields(errors)).containsExactly("imageUrl");
    }

    private static Set<String> fields(List<ApiErrorDetail> errors) {
        return errors.stream().map(ApiErrorDetail::field).collect(Collectors.toSet());
    }

    private static ProductEntity completeCoreEntity() {
        ProductEntity entity = new ProductEntity();
        entity.setName("Mu bao hiem LS2 FF800");
        entity.setSlug("mu-bao-hiem-ls2-ff800");
        entity.setCategory(new CategoryEntity());
        entity.setBrand(new BrandEntity());
        entity.setGender("Unisex");
        entity.setSku("LS2-FF800");
        entity.setRetailPrice(BigDecimal.valueOf(3690000));
        return entity;
    }

    private static ProductVariantEntity completeVariant() {
        ProductVariantEntity variant = new ProductVariantEntity();
        variant.setId("var_1");
        variant.setSku("LS2-FF800-RED-M");
        variant.setRetailPrice(BigDecimal.valueOf(3690000));
        variant.setImageUrl("http://localhost:9000/bigbike-media/products/ls2-ff800/red.jpg");
        return variant;
    }

    private static ImageAssetRequest image(String url) {
        ImageAssetRequest request = new ImageAssetRequest();
        request.setUrl(url);
        request.setAlt("Alt");
        return request;
    }
}
