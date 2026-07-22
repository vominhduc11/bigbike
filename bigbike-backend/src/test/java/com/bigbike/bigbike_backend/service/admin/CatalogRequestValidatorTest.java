package com.bigbike.bigbike_backend.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.api.admin.dto.GalleryImageRequest;
import com.bigbike.bigbike_backend.api.admin.dto.ProductTranslationRequest;
import com.bigbike.bigbike_backend.api.admin.dto.UpsertProductRequest;
import com.bigbike.bigbike_backend.api.admin.dto.VariantOptionRequest;
import com.bigbike.bigbike_backend.api.admin.dto.VariantRequest;
import com.bigbike.bigbike_backend.api.common.ApiErrorDetail;
import com.bigbike.bigbike_backend.config.MediaUrlProperties;
import com.bigbike.bigbike_backend.domain.catalog.GalleryMedia;
import com.bigbike.bigbike_backend.domain.catalog.ImageAsset;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.CategoryEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantGalleryImageEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.BrandJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.CategoryJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductVariantJpaRepository;
import com.bigbike.bigbike_backend.service.security.HomeVideoUrlPolicy;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;

class CatalogRequestValidatorTest {

    private CatalogRequestValidator validator;
    private MediaUrlProperties mediaUrlProperties;
    private ProductJpaRepository productJpaRepository;
    private CategoryJpaRepository categoryJpaRepository;
    private HomeVideoUrlPolicy homeVideoUrlPolicy;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        productJpaRepository = mock(ProductJpaRepository.class);
        ProductVariantJpaRepository productVariantJpaRepository = mock(ProductVariantJpaRepository.class);
        categoryJpaRepository = mock(CategoryJpaRepository.class);
        BrandJpaRepository brandJpaRepository = mock(BrandJpaRepository.class);
        mediaUrlProperties = mock(MediaUrlProperties.class);

        when(mediaUrlProperties.getPublicBaseUrl()).thenReturn("http://localhost:9000/bigbike-media");

        ObjectProvider<ProductJpaRepository> productJpaRepositoryProvider = mock(ObjectProvider.class);
        when(productJpaRepositoryProvider.getIfAvailable()).thenReturn(productJpaRepository);

        ObjectProvider<ProductVariantJpaRepository> productVariantJpaRepositoryProvider = mock(ObjectProvider.class);
        when(productVariantJpaRepositoryProvider.getIfAvailable()).thenReturn(productVariantJpaRepository);

        ObjectProvider<CategoryJpaRepository> categoryJpaRepositoryProvider = mock(ObjectProvider.class);
        when(categoryJpaRepositoryProvider.getIfAvailable()).thenReturn(categoryJpaRepository);

        ObjectProvider<BrandJpaRepository> brandJpaRepositoryProvider = mock(ObjectProvider.class);
        when(brandJpaRepositoryProvider.getIfAvailable()).thenReturn(brandJpaRepository);

        homeVideoUrlPolicy = mock(HomeVideoUrlPolicy.class);
        when(homeVideoUrlPolicy.isAllowed(org.mockito.ArgumentMatchers.anyString())).thenReturn(true);
        when(homeVideoUrlPolicy.isAllowedForProvider(
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.anyString()
        )).thenReturn(true);

        validator = new CatalogRequestValidator(
                productJpaRepositoryProvider,
                productVariantJpaRepositoryProvider,
                categoryJpaRepositoryProvider,
                brandJpaRepositoryProvider,
                mediaUrlProperties,
                homeVideoUrlPolicy,
                null
        );
    }

    private ProductTranslationRequest validTranslation() {
        ProductTranslationRequest translation = new ProductTranslationRequest();
        ProductTranslationRequest.ProductContentRequest en = new ProductTranslationRequest.ProductContentRequest();
        en.setName("English Name");
        translation.setEn(en);
        return translation;
    }

    private UpsertProductRequest createBaseRequest() {
        UpsertProductRequest request = new UpsertProductRequest();
        request.setSlug("test-slug");
        request.setName("Test Product");
        request.setPublishStatus(com.bigbike.bigbike_backend.domain.catalog.PublishStatus.PUBLISHED);
        request.setRetailPrice(BigDecimal.TEN);
        request.setCategoryId("cat-id");
        request.setTranslations(validTranslation());
        return request;
    }

    @Test
    void validateProductRequest_create_missingNameAndSlug_stillFlaggedHere() {
        UpsertProductRequest request = new UpsertProductRequest();
        request.setPublishStatus(com.bigbike.bigbike_backend.domain.catalog.PublishStatus.DRAFT);

        List<ApiErrorDetail> errors = new ArrayList<>();
        validator.validateProductRequest(request, null, true, false, errors);

        assertThat(errors.stream().map(ApiErrorDetail::field))
                .contains("slug", "name");
    }

    @Test
    void validateProductRequest_create_missingRetailPriceAndCategoryId_deferredToPostMergeCheck() {
        // PRODUCT_RULE_005 (2026-07-07) — retailPrice/categoryId requiredness moved out of this
        // request-level validator into AdminMutationValidators.validateProductFieldsRequired,
        // which runs post-merge (conditional on has-variants). This layer must no longer flag
        // them, or a has-variants product with no product-level price/category-at-request-time
        // would be incorrectly blocked before the post-merge check even runs.
        UpsertProductRequest request = new UpsertProductRequest();
        request.setSlug("test-slug");
        request.setName("Test Product");
        request.setPublishStatus(com.bigbike.bigbike_backend.domain.catalog.PublishStatus.DRAFT);
        request.setTranslations(validTranslation());

        List<ApiErrorDetail> errors = new ArrayList<>();
        validator.validateProductRequest(request, null, true, false, errors);

        assertThat(errors.stream().map(ApiErrorDetail::field))
                .doesNotContain("retailPrice", "categoryId");
    }

    @Test
    void validateAndResolveCategories_preservesSubmittedOrderAndAcceptsLegacyAlias() {
        CategoryEntity helmet = category("cat-helmet", true, false);
        CategoryEntity jacket = category("cat-jacket", true, false);
        when(categoryJpaRepository.findById("cat-jacket")).thenReturn(java.util.Optional.of(jacket));
        when(categoryJpaRepository.findById("cat-helmet")).thenReturn(java.util.Optional.of(helmet));

        UpsertProductRequest plural = new UpsertProductRequest();
        plural.setCategoryIds(List.of("cat-jacket", "cat-helmet"));
        List<ApiErrorDetail> pluralErrors = new ArrayList<>();

        assertThat(validator.validateAndResolveCategories(plural, true, pluralErrors))
                .extracting(CategoryEntity::getId)
                .containsExactly("cat-jacket", "cat-helmet");
        assertThat(pluralErrors).isEmpty();

        UpsertProductRequest legacy = new UpsertProductRequest();
        legacy.setCategoryId("cat-helmet");
        List<ApiErrorDetail> legacyErrors = new ArrayList<>();

        assertThat(validator.validateAndResolveCategories(legacy, true, legacyErrors))
                .extracting(CategoryEntity::getId)
                .containsExactly("cat-helmet");
        assertThat(legacyErrors).isEmpty();
    }

    @Test
    void validateAndResolveCategories_rejectsMissingDuplicateAndConflictingFields() {
        UpsertProductRequest missingCreate = new UpsertProductRequest();
        List<ApiErrorDetail> missingErrors = new ArrayList<>();
        assertThat(validator.validateAndResolveCategories(missingCreate, true, missingErrors)).isNull();
        assertThat(missingErrors).extracting(ApiErrorDetail::field).containsExactly("categoryIds");

        UpsertProductRequest duplicate = new UpsertProductRequest();
        duplicate.setCategoryIds(List.of("cat-helmet", "cat-helmet"));
        List<ApiErrorDetail> duplicateErrors = new ArrayList<>();
        validator.validateAndResolveCategories(duplicate, false, duplicateErrors);
        assertThat(duplicateErrors).extracting(ApiErrorDetail::field).containsExactly("categoryIds[1]", "categoryIds");

        UpsertProductRequest conflict = new UpsertProductRequest();
        conflict.setCategoryIds(List.of("cat-helmet"));
        conflict.setCategoryId("cat-jacket");
        List<ApiErrorDetail> conflictErrors = new ArrayList<>();
        assertThat(validator.validateAndResolveCategories(conflict, false, conflictErrors)).isNull();
        assertThat(conflictErrors).extracting(ApiErrorDetail::code).containsExactly("CONFLICT");
    }

    @Test
    void validateAndResolveCategories_rejectsUnknownHiddenAndTrashedCategories() {
        CategoryEntity hidden = category("cat-hidden", false, false);
        CategoryEntity trashed = category("cat-trash", true, true);
        when(categoryJpaRepository.findById("cat-hidden")).thenReturn(java.util.Optional.of(hidden));
        when(categoryJpaRepository.findById("cat-trash")).thenReturn(java.util.Optional.of(trashed));

        UpsertProductRequest request = new UpsertProductRequest();
        request.setCategoryIds(List.of("cat-missing", "cat-hidden", "cat-trash"));
        List<ApiErrorDetail> errors = new ArrayList<>();

        assertThat(validator.validateAndResolveCategories(request, true, errors)).isEmpty();
        assertThat(errors).extracting(ApiErrorDetail::code)
                .containsExactly("NOT_FOUND", "INVALID_STATE", "INVALID_STATE");
    }

    @Test
    void validateProductRequest_variantMissingRetailPrice_productHasSharedRetailPrice_notFlagged() {
        // PRODUCT_RULE_013 (2026-07-07) — a variant without its own retailPrice falls back to the
        // product's shared retailPrice, so it must not be flagged REQUIRED when the product has one.
        UpsertProductRequest request = createBaseRequest(); // retailPrice = TEN

        VariantRequest vReq = new VariantRequest();
        vReq.setSku("VAR-1");
        request.setVariants(Collections.singletonList(vReq));

        List<ApiErrorDetail> errors = new ArrayList<>();
        validator.validateProductRequest(request, null, true, false, errors);

        assertThat(errors.stream().map(ApiErrorDetail::field))
                .doesNotContain("variants[0].retailPrice");
    }

    @Test
    void validateProductRequest_variantMissingRetailPrice_productHasNoSharedRetailPrice_stillFlagged() {
        UpsertProductRequest request = createBaseRequest();
        request.setRetailPrice(null); // no shared price to fall back to

        VariantRequest vReq = new VariantRequest();
        vReq.setSku("VAR-1");
        request.setVariants(Collections.singletonList(vReq));

        List<ApiErrorDetail> errors = new ArrayList<>();
        validator.validateProductRequest(request, null, true, false, errors);

        assertThat(errors.stream().map(ApiErrorDetail::field))
                .contains("variants[0].retailPrice");
    }

    @Test
    void validateProductRequest_variantSalePriceWithoutOwnRetailPrice_isRejected() {
        // A variant with no retailPrice of its own is not "self-priced" (VariantPricing.hasOwnPrice)
        // — a salePrice submitted alone would be silently ignored, so it must be rejected instead.
        UpsertProductRequest request = createBaseRequest(); // has a shared retailPrice

        VariantRequest vReq = new VariantRequest();
        vReq.setSku("VAR-1");
        vReq.setSalePrice(BigDecimal.ONE);
        request.setVariants(Collections.singletonList(vReq));

        List<ApiErrorDetail> errors = new ArrayList<>();
        validator.validateProductRequest(request, null, true, false, errors);

        assertThat(errors.stream().map(ApiErrorDetail::field))
                .contains("variants[0].salePrice");
    }

    @Test
    void validateProductRequest_newOutsideMinioGalleryUrl_isRejected() {
        UpsertProductRequest request = createBaseRequest();

        GalleryImageRequest galleryReq = new GalleryImageRequest();
        galleryReq.setUrl("https://cdn.external.vn/uploads/xe.jpg");
        galleryReq.setMediaType("image");
        request.setGallery(Collections.singletonList(galleryReq));

        List<ApiErrorDetail> errors = new ArrayList<>();
        validator.validateProductRequest(request, null, true, false, errors);

        assertThat(errors)
                .hasSize(1)
                .first()
                .satisfies(error -> {
                    assertThat(error.field()).isEqualTo("gallery[0].url");
                    assertThat(error.code()).isEqualTo("INVALID_VALUE");
                });
    }

    @Test
    void validateProductRequest_legacyOutsideMinioGalleryUrl_isAccepted() {
        // Setup existing product with same outside url
        ProductEntity current = new ProductEntity();
        current.setGallery(Collections.singletonList(
                GalleryMedia.ofImage(new ImageAsset(null, "https://cdn.external.vn/uploads/xe.jpg", null, null, null, null))));

        UpsertProductRequest request = createBaseRequest();

        GalleryImageRequest galleryReq = new GalleryImageRequest();
        galleryReq.setUrl("https://cdn.external.vn/uploads/xe.jpg");
        galleryReq.setMediaType("image");
        request.setGallery(Collections.singletonList(galleryReq));

        List<ApiErrorDetail> errors = new ArrayList<>();
        // create = false for updating product
        validator.validateProductRequest(request, current, false, false, errors);

        assertThat(errors).isEmpty();
    }

    @Test
    void validateProductRequest_minioAndProxyGalleryUrl_isAccepted() {
        UpsertProductRequest request = createBaseRequest();

        List<GalleryImageRequest> gallery = new ArrayList<>();
        GalleryImageRequest imgMinio = new GalleryImageRequest();
        imgMinio.setUrl("http://localhost:9000/bigbike-media/wp-uploads/2024/05/xe.jpg");
        imgMinio.setMediaType("image");
        gallery.add(imgMinio);

        GalleryImageRequest imgProxy = new GalleryImageRequest();
        imgProxy.setUrl("/media/wp-uploads/2024/05/xe2.jpg");
        imgProxy.setMediaType("image");
        gallery.add(imgProxy);

        request.setGallery(gallery);

        List<ApiErrorDetail> errors = new ArrayList<>();
        validator.validateProductRequest(request, null, true, false, errors);

        assertThat(errors).isEmpty();
    }

    @Test
    void validateProductRequest_newOutsideMinioVariantGalleryUrl_isRejected() {
        UpsertProductRequest request = createBaseRequest();

        VariantRequest vReq = new VariantRequest();
        vReq.setSku("VAR-SKU-1");
        vReq.setRetailPrice(BigDecimal.TEN);
        VariantOptionRequest opt = new VariantOptionRequest();
        opt.setOptionName("color");
        opt.setOptionValue("Red");
        vReq.setOptions(Collections.singletonList(opt));

        GalleryImageRequest variantGalleryReq = new GalleryImageRequest();
        variantGalleryReq.setUrl("https://cdn.external.vn/uploads/xe.jpg");
        variantGalleryReq.setMediaType("image");
        vReq.setGallery(Collections.singletonList(variantGalleryReq));
        request.setVariants(Collections.singletonList(vReq));

        List<ApiErrorDetail> errors = new ArrayList<>();
        validator.validateProductRequest(request, null, true, false, errors);

        assertThat(errors)
                .hasSize(1)
                .first()
                .satisfies(error -> {
                    assertThat(error.field()).isEqualTo("variants[0].gallery[0].url");
                    assertThat(error.code()).isEqualTo("INVALID_VALUE");
                });
    }

    @Test
    void validateProductRequest_legacyOutsideMinioVariantGalleryUrl_isAccepted() {
        // Setup existing product and variant with same outside url
        ProductEntity current = new ProductEntity();
        ProductVariantEntity existingVariant = new ProductVariantEntity();
        existingVariant.setId("existing-var-id");
        existingVariant.setRetailPrice(BigDecimal.TEN);
        ProductVariantGalleryImageEntity existingImg = new ProductVariantGalleryImageEntity();
        existingImg.setImageUrl("https://cdn.external.vn/uploads/xe.jpg");
        existingImg.setMediaType("image");
        existingVariant.setGallery(Collections.singletonList(existingImg));
        current.setVariants(Collections.singletonList(existingVariant));

        UpsertProductRequest request = createBaseRequest();

        VariantRequest vReq = new VariantRequest();
        vReq.setId("existing-var-id");
        vReq.setSku("VAR-SKU-1");
        VariantOptionRequest opt = new VariantOptionRequest();
        opt.setOptionName("color");
        opt.setOptionValue("Red");
        vReq.setOptions(Collections.singletonList(opt));

        GalleryImageRequest variantGalleryReq = new GalleryImageRequest();
        variantGalleryReq.setUrl("https://cdn.external.vn/uploads/xe.jpg");
        variantGalleryReq.setMediaType("image");
        vReq.setGallery(Collections.singletonList(variantGalleryReq));
        request.setVariants(Collections.singletonList(vReq));

        List<ApiErrorDetail> errors = new ArrayList<>();
        validator.validateProductRequest(request, current, false, false, errors);

        assertThat(errors).isEmpty();
    }

    @Test
    void validateProductRequest_newOutsideMinioInlineHtmlImage_isRejected() {
        UpsertProductRequest request = createBaseRequest();
        com.bigbike.bigbike_backend.domain.catalog.DescriptionBlock.ParagraphBlock p =
                new com.bigbike.bigbike_backend.domain.catalog.DescriptionBlock.ParagraphBlock();
        p.setType("paragraph");
        p.setHtml("<p>Xem <img src=\"https://cdn.external.vn/uploads/xe.jpg\"> nhé</p>");
        request.setDescriptionBlocks(java.util.List.of(p));

        List<ApiErrorDetail> errors = new ArrayList<>();
        validator.validateProductRequest(request, null, true, false, errors);

        assertThat(errors).anySatisfy(error -> {
            assertThat(error.field()).startsWith("descriptionBlocks[0].html.img[");
            assertThat(error.code()).isEqualTo("INVALID_VALUE");
        });
    }

    @Test
    void validateProductRequest_legacyInlineHtmlImage_isAccepted() {
        ProductEntity current = new ProductEntity();
        com.bigbike.bigbike_backend.domain.catalog.DescriptionBlock.ParagraphBlock existing =
                new com.bigbike.bigbike_backend.domain.catalog.DescriptionBlock.ParagraphBlock();
        existing.setType("paragraph");
        existing.setHtml("<p><img src=\"https://cdn.external.vn/uploads/xe.jpg\"></p>");
        current.setDescriptionBlocks(java.util.List.of(existing));

        UpsertProductRequest request = createBaseRequest();
        com.bigbike.bigbike_backend.domain.catalog.DescriptionBlock.ParagraphBlock p =
                new com.bigbike.bigbike_backend.domain.catalog.DescriptionBlock.ParagraphBlock();
        p.setType("paragraph");
        p.setHtml("<p><img src=\"https://cdn.external.vn/uploads/xe.jpg\"></p>");
        request.setDescriptionBlocks(java.util.List.of(p));

        List<ApiErrorDetail> errors = new ArrayList<>();
        validator.validateProductRequest(request, current, false, false, errors);

        assertThat(errors).noneSatisfy(error ->
                assertThat(error.field()).startsWith("descriptionBlocks[0].html"));
    }

    @Test
    void validateProductRequest_newInvalidVideoBlockUrl_isRejected() {
        when(homeVideoUrlPolicy.isAllowedForProvider("tiktok", "https://vt.tiktok.com/ZSabcDEF/"))
                .thenReturn(false);
        UpsertProductRequest request = createBaseRequest();
        com.bigbike.bigbike_backend.domain.catalog.DescriptionBlock.VideoBlock video =
                new com.bigbike.bigbike_backend.domain.catalog.DescriptionBlock.VideoBlock();
        video.setType("video");
        video.setProvider("tiktok");
        video.setUrl("https://vt.tiktok.com/ZSabcDEF/");
        request.setDescriptionBlocks(java.util.List.of(video));

        List<ApiErrorDetail> errors = new ArrayList<>();
        validator.validateProductRequest(request, null, true, false, errors);

        assertThat(errors).anySatisfy(error -> {
            assertThat(error.field()).isEqualTo("descriptionBlocks[0].url");
            assertThat(error.code()).isEqualTo("INVALID_VALUE");
        });
    }

    @Test
    void validateProductRequest_unchangedLegacyVideoBlockUrl_isAccepted() {
        String legacyUrl = "https://legacy.example/video/123";
        when(homeVideoUrlPolicy.isAllowedForProvider("youtube", legacyUrl)).thenReturn(false);

        var existing = new com.bigbike.bigbike_backend.domain.catalog.DescriptionBlock.VideoBlock();
        existing.setType("video");
        existing.setProvider("youtube");
        existing.setUrl(legacyUrl);
        ProductEntity current = new ProductEntity();
        current.setDescriptionBlocks(java.util.List.of(existing));

        var submitted = new com.bigbike.bigbike_backend.domain.catalog.DescriptionBlock.VideoBlock();
        submitted.setType("video");
        submitted.setProvider("youtube");
        submitted.setUrl(legacyUrl);
        UpsertProductRequest request = createBaseRequest();
        request.setDescriptionBlocks(java.util.List.of(submitted));

        List<ApiErrorDetail> errors = new ArrayList<>();
        validator.validateProductRequest(request, current, false, false, errors);

        assertThat(errors).noneSatisfy(error ->
                assertThat(error.field()).isEqualTo("descriptionBlocks[0].url"));
    }

    @Test
    void validateProductRequest_slugEnEqualsViSlug_isAccepted() {
        UpsertProductRequest request = createBaseRequest();
        request.setSlug("scs-s10x");

        ProductTranslationRequest translation = new ProductTranslationRequest();
        ProductTranslationRequest.ProductContentRequest en = new ProductTranslationRequest.ProductContentRequest();
        en.setName("English Name");
        en.setSlug("scs-s10x"); // Trùng với vi slug của chính nó
        translation.setEn(en);
        request.setTranslations(translation);

        // Mocks for uniqueness checks - return empty or self
        ProductEntity currentProduct = new ProductEntity();
        currentProduct.setId("current-id");
        when(productJpaRepository.findBySlug("scs-s10x")).thenReturn(java.util.Optional.of(currentProduct));
        when(productJpaRepository.findBySlugEn("scs-s10x")).thenReturn(java.util.Optional.empty());

        List<ApiErrorDetail> errors = new ArrayList<>();
        // currentId matches currentProduct.getId()
        validator.validateProductRequest(request, currentProduct, false, false, errors);

        assertThat(errors).isEmpty();
    }

    @Test
    void validateProductRequest_slugEnCollidesWithOtherProductViSlug_isRejected() {
        UpsertProductRequest request = createBaseRequest();
        request.setSlug("scs-s10x");

        ProductTranslationRequest translation = new ProductTranslationRequest();
        ProductTranslationRequest.ProductContentRequest en = new ProductTranslationRequest.ProductContentRequest();
        en.setName("English Name");
        en.setSlug("other-vi-slug");
        translation.setEn(en);
        request.setTranslations(translation);

        ProductEntity other = new ProductEntity();
        other.setId("other-id");
        when(productJpaRepository.findBySlug("other-vi-slug")).thenReturn(java.util.Optional.of(other));
        when(productJpaRepository.findBySlugEn("other-vi-slug")).thenReturn(java.util.Optional.empty());

        List<ApiErrorDetail> errors = new ArrayList<>();
        validator.validateProductRequest(request, null, true, false, errors);

        assertThat(errors)
                .hasSize(1)
                .first()
                .satisfies(error -> {
                    assertThat(error.field()).isEqualTo("translations.en.slug");
                    assertThat(error.code()).isEqualTo("DUPLICATE");
                    assertThat(error.message()).isEqualTo("English slug is already in use.");
                });
    }

    @Test
    void validateProductRequest_slugEnCollidesWithOtherProductEnSlug_isRejected() {
        UpsertProductRequest request = createBaseRequest();
        request.setSlug("scs-s10x");

        ProductTranslationRequest translation = new ProductTranslationRequest();
        ProductTranslationRequest.ProductContentRequest en = new ProductTranslationRequest.ProductContentRequest();
        en.setName("English Name");
        en.setSlug("other-en-slug");
        translation.setEn(en);
        request.setTranslations(translation);

        ProductEntity other = new ProductEntity();
        other.setId("other-id");
        when(productJpaRepository.findBySlug("other-en-slug")).thenReturn(java.util.Optional.empty());
        when(productJpaRepository.findBySlugEn("other-en-slug")).thenReturn(java.util.Optional.of(other));

        List<ApiErrorDetail> errors = new ArrayList<>();
        validator.validateProductRequest(request, null, true, false, errors);

        assertThat(errors)
                .hasSize(1)
                .first()
                .satisfies(error -> {
                    assertThat(error.field()).isEqualTo("translations.en.slug");
                    assertThat(error.code()).isEqualTo("DUPLICATE");
                    assertThat(error.message()).isEqualTo("English slug is already in use.");
                });
    }

    private static CategoryEntity category(String id, boolean visible, boolean deleted) {
        CategoryEntity category = new CategoryEntity();
        category.setId(id);
        category.setVisible(visible);
        category.setDeleted(deleted);
        return category;
    }
}
