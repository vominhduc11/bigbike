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
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductGalleryImageEntity;
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

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        productJpaRepository = mock(ProductJpaRepository.class);
        ProductVariantJpaRepository productVariantJpaRepository = mock(ProductVariantJpaRepository.class);
        CategoryJpaRepository categoryJpaRepository = mock(CategoryJpaRepository.class);
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

        HomeVideoUrlPolicy homeVideoUrlPolicy = mock(HomeVideoUrlPolicy.class);
        when(homeVideoUrlPolicy.isAllowed(org.mockito.ArgumentMatchers.anyString())).thenReturn(true);

        validator = new CatalogRequestValidator(
                productJpaRepositoryProvider,
                productVariantJpaRepositoryProvider,
                categoryJpaRepositoryProvider,
                brandJpaRepositoryProvider,
                mediaUrlProperties,
                homeVideoUrlPolicy
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
        ProductGalleryImageEntity existingImg = new ProductGalleryImageEntity();
        existingImg.setImageUrl("https://cdn.external.vn/uploads/xe.jpg");
        existingImg.setMediaType("image");
        current.setGallery(Collections.singletonList(existingImg));

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
}
