package com.bigbike.bigbike_backend.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import static org.assertj.core.api.Assertions.assertThat;

import com.bigbike.bigbike_backend.api.admin.dto.ProductTranslationRequest;
import com.bigbike.bigbike_backend.api.admin.dto.UpsertProductRequest;
import com.bigbike.bigbike_backend.api.admin.dto.VariantOptionRequest;
import com.bigbike.bigbike_backend.api.admin.dto.VariantRequest;
import com.bigbike.bigbike_backend.domain.catalog.HomepageBlock;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.BrandEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.CategoryEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.content.ArticleEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductVariantJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.BrandJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.CategoryJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.content.ArticleJpaRepository;
import com.bigbike.bigbike_backend.service.admin.ProductMutationService;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@Sql(scripts = "/db/test-seed.sql", executionPhase = Sql.ExecutionPhase.BEFORE_TEST_CLASS)
class AdminMutationApiTest {

    private static final String MEDIA_PUBLIC_BASE_URL = "http://localhost:9000/bigbike-media";
    private static final UUID DEV_ADMIN_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

    private MockMvc mockMvc;

    @Autowired
    private WebApplicationContext webApplicationContext;

    @Autowired
    private ProductJpaRepository productJpaRepository;

    @Autowired
    private CategoryJpaRepository categoryJpaRepository;

    @Autowired
    private BrandJpaRepository brandJpaRepository;

    @Autowired
    private ArticleJpaRepository articleJpaRepository;

    @Autowired
    private ProductMutationService productMutationService;

    @Autowired
    private ProductVariantJpaRepository productVariantJpaRepository;

    @BeforeEach
    void setup() {
        this.mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build();
    }

    @Test
    void shouldCreateUpdateAndPublishProduct() throws Exception {
        String suffix = String.valueOf(System.currentTimeMillis());
        String slug = "phase4g-product-" + suffix;

        String createPayload = """
                {
                  "slug": "%s",
                  "name": "Phase 4G Product %s",
                  "categoryId": "cat_helmet",
                  "brandId": "brand_ls2",
                  "gender": "Unisex",
                  "sku": "PHASE4G-%s",
                  "retailPrice": 2500000,
                  "salePrice": 2300000,
                  "currency": "VND",
                  "stockState": "IN_STOCK",
                  "publishStatus": "DRAFT",
                  "translations": {
                    "en": { "name": "Phase 4G Product EN %s" }
                  },
                  "seo": {
                    "title": "Phase 4G SEO title %s",
                    "description": "Phase 4G SEO description %s",
                    "canonicalUrl": "https://bigbike.vn/products/%s"
                  },
                  "image": {
                    "url": "%s/wp-uploads/products/%s.jpg",
                    "alt": "Phase 4G Product"
                  }
                }
                """.formatted(slug, suffix, suffix, suffix, suffix, suffix, slug, MEDIA_PUBLIC_BASE_URL, slug);

        mockMvc.perform(post("/api/v1/admin/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .characterEncoding(StandardCharsets.UTF_8)
                        .header("X-Admin-Permissions", "products.update")
                        .content(createPayload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.slug").value(slug))
                .andExpect(jsonPath("$.data.publishStatus").value("DRAFT"))
                .andExpect(jsonPath("$.data.price.currency").value("VND"));

        ProductEntity created = productJpaRepository.findBySlug(slug)
                .orElseThrow(() -> new IllegalStateException("Expected created product."));

        String updatePayload = """
                {
                  "name": "Phase 4G Product Updated %s",
                  "salePrice": 2200000,
                  "translations": {
                    "en": { "name": "Phase 4G Product Updated EN %s" }
                  }
                }
                """.formatted(suffix, suffix);

        mockMvc.perform(patch("/api/v1/admin/products/{id}", created.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .characterEncoding(StandardCharsets.UTF_8)
                        .header("X-Admin-Permissions", "products.update")
                        .content(updatePayload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("Phase 4G Product Updated " + suffix))
                .andExpect(jsonPath("$.data.price.salePrice").value(2200000));

        String publishPayload = """
                {
                  "publishStatus": "PUBLISHED"
                }
                """;

        mockMvc.perform(patch("/api/v1/admin/products/{id}/publish", created.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .characterEncoding(StandardCharsets.UTF_8)
                        .header("X-Admin-Permissions", "products.update")
                        .content(publishPayload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.publishStatus").value("PUBLISHED"));
    }

    @Test
    void productDetailSaveCannotPublishDraftButPreservesPublishedStatus() throws Exception {
        String suffix = String.valueOf(System.currentTimeMillis());
        String slug = "product-save-status-" + suffix;
        String payloadTemplate = """
                {
                  "slug": "%s",
                  "name": "Product Save Status %s",
                  "categoryId": "cat_helmet",
                  "brandId": "brand_ls2",
                  "gender": "Unisex",
                  "sku": "SAVE-STATUS-%s",
                  "retailPrice": 1500000,
                  "publishStatus": "%s",
                  "translations": {
                    "en": { "name": "Product Save Status EN %s" }
                  },
                  "image": {
                    "url": "%s/wp-uploads/products/%s.jpg",
                    "alt": "Product Save Status"
                  }
                }
                """;

        String publishedCreate = payloadTemplate.formatted(
                slug, suffix, suffix, "PUBLISHED", suffix, MEDIA_PUBLIC_BASE_URL, slug);
        mockMvc.perform(post("/api/v1/admin/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .characterEncoding(StandardCharsets.UTF_8)
                        .header("X-Admin-Permissions", "products.update")
                        .content(publishedCreate))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.details[0].field").value("publishStatus"));

        String draftCreate = payloadTemplate.formatted(
                slug, suffix, suffix, "DRAFT", suffix, MEDIA_PUBLIC_BASE_URL, slug);
        mockMvc.perform(post("/api/v1/admin/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .characterEncoding(StandardCharsets.UTF_8)
                        .header("X-Admin-Permissions", "products.update")
                        .content(draftCreate))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.publishStatus").value("DRAFT"));

        ProductEntity product = productJpaRepository.findBySlug(slug)
                .orElseThrow(() -> new IllegalStateException("Expected created product."));

        mockMvc.perform(patch("/api/v1/admin/products/{id}", product.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Admin-Permissions", "products.update")
                        .content("{\"publishStatus\":\"PUBLISHED\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.details[0].field").value("publishStatus"));
        assertThat(productJpaRepository.findById(product.getId()).orElseThrow().getPublishStatus())
                .isEqualTo(PublishStatus.DRAFT);

        mockMvc.perform(patch("/api/v1/admin/products/{id}/publish", product.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Admin-Permissions", "products.update")
                        .content("{\"publishStatus\":\"PUBLISHED\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.publishStatus").value("PUBLISHED"));

        mockMvc.perform(patch("/api/v1/admin/products/{id}", product.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Admin-Permissions", "products.update")
                        .content("{\"publishStatus\":\"PUBLISHED\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.publishStatus").value("PUBLISHED"));

        mockMvc.perform(patch("/api/v1/admin/products/{id}", product.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Admin-Permissions", "products.update")
                        .content("{\"publishStatus\":\"DRAFT\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.details[0].field").value("publishStatus"));
        assertThat(productJpaRepository.findById(product.getId()).orElseThrow().getPublishStatus())
                .isEqualTo(PublishStatus.PUBLISHED);
    }

    @Test
    void publishGateRejectsSystemOnlyCategoryAndBrand() throws Exception {
        String suffix = String.valueOf(System.currentTimeMillis());
        String slug = "system-bucket-publish-gate-" + suffix;
        String payload = """
                {
                  "slug": "%s",
                  "name": "System Bucket Publish Gate %s",
                  "categoryId": "uncategorized",
                  "brandId": "uncategorized-brand",
                  "gender": "Unisex",
                  "sku": "SYSTEM-BUCKET-%s",
                  "retailPrice": 1500000,
                  "publishStatus": "DRAFT",
                  "translations": {
                    "en": { "name": "System Bucket Publish Gate EN %s" }
                  },
                  "image": {
                    "url": "%s/wp-uploads/products/%s.jpg",
                    "alt": "System Bucket Publish Gate"
                  }
                }
                """.formatted(
                slug, suffix, suffix, suffix, MEDIA_PUBLIC_BASE_URL, slug);

        mockMvc.perform(post("/api/v1/admin/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .characterEncoding(StandardCharsets.UTF_8)
                        .header("X-Admin-Permissions", "products.update")
                        .content(payload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.publishStatus").value("DRAFT"));

        ProductEntity product = productJpaRepository.findBySlug(slug)
                .orElseThrow(() -> new IllegalStateException("Expected created product."));
        mockMvc.perform(patch("/api/v1/admin/products/{id}/publish", product.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Admin-Permissions", "products.update")
                        .content("{\"publishStatus\":\"PUBLISHED\"}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.error.code").value("PRODUCT_NOT_READY_TO_PUBLISH"))
                .andExpect(jsonPath("$.error.details[0].field").value("categoryIds"))
                .andExpect(jsonPath("$.error.details[1].field").value("brandId"));
    }

    @Test
    void shouldPreviewProductWithoutPersisting() throws Exception {
        long countBefore = productJpaRepository.count();
        String slug = "preview-dry-run-" + System.currentTimeMillis();

        String previewPayload = """
                {
                  "slug": "%s",
                  "name": "Preview Dry Run Product",
                  "categoryId": "cat_helmet",
                  "brandId": "brand_ls2",
                  "retailPrice": 1990000,
                  "salePrice": 1790000,
                  "currency": "VND",
                  "publishStatus": "DRAFT"
                }
                """.formatted(slug);

        // Returns the public Product shape (publicView=true): retail/sale present —
        // exactly what the storefront PDP would render.
        mockMvc.perform(post("/api/v1/admin/products/preview")
                        .contentType(MediaType.APPLICATION_JSON)
                        .characterEncoding(StandardCharsets.UTF_8)
                        .header("X-Admin-Permissions", "products.update")
                        .content(previewPayload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("Preview Dry Run Product"))
                .andExpect(jsonPath("$.data.publishStatus").value("DRAFT"))
                .andExpect(jsonPath("$.data.price.salePrice").value(1790000))
                .andExpect(jsonPath("$.data.price.currency").value("VND"));

        // Dry-run must NOT persist: no new row, and the slug never lands in the DB.
        assertThat(productJpaRepository.count()).isEqualTo(countBefore);
        assertThat(productJpaRepository.findBySlug(slug)).isEmpty();
    }

    @Test
    void shouldRejectUnsupportedProductPreviewLanguage() throws Exception {
        String slug = "preview-invalid-lang-" + System.currentTimeMillis();
        mockMvc.perform(post("/api/v1/admin/products/preview")
                        .param("lang", "fr")
                        .contentType(MediaType.APPLICATION_JSON)
                        .characterEncoding(StandardCharsets.UTF_8)
                        .header("X-Admin-Permissions", "products.update")
                        .content("""
                                {
                                  "slug": "%s",
                                  "name": "Preview Invalid Language",
                                  "categoryId": "cat_helmet",
                                  "brandId": "brand_ls2",
                                  "gender": "Unisex",
                                  "sku": "PREVIEW-INVALID-LANG",
                                  "retailPrice": 1500000,
                                  "publishStatus": "DRAFT"
                                }
                                """.formatted(slug)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
    }

    @Test
    void shouldPreviewExistingProductWithoutFlaggingItsOwnSlugAsDuplicate() throws Exception {
        // Regression: editing an existing product and opening the live preview sends
        // the product's already-saved slug. Slug uniqueness is a persistence concern
        // and must be skipped for the dry-run, otherwise the preview always 400s
        // ("slug DUPLICATE") and the editor can never preview a saved product.
        String suffix = String.valueOf(System.currentTimeMillis());
        String slug = "preview-existing-slug-" + suffix;

        String createPayload = """
                {
                  "slug": "%s",
                  "name": "Preview Existing Slug Product",
                  "categoryId": "cat_helmet",
                  "brandId": "brand_ls2",
                  "gender": "Unisex",
                  "sku": "PREVIEW-%s",
                  "retailPrice": 1990000,
                  "currency": "VND",
                  "publishStatus": "DRAFT",
                  "translations": {
                    "en": { "name": "Preview Existing Slug Product EN" }
                  }
                }
                """.formatted(slug, slug);

        mockMvc.perform(post("/api/v1/admin/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .characterEncoding(StandardCharsets.UTF_8)
                        .header("X-Admin-Permissions", "products.update")
                        .content(createPayload))
                .andExpect(status().isOk());

        // Preview with the SAME slug — must succeed, not 400 DUPLICATE.
        mockMvc.perform(post("/api/v1/admin/products/preview")
                        .contentType(MediaType.APPLICATION_JSON)
                        .characterEncoding(StandardCharsets.UTF_8)
                        .header("X-Admin-Permissions", "products.update")
                        .content(createPayload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.slug").value(slug));
    }

    @Test
    void shouldPreviewArticleWithoutPersisting() throws Exception {
        long countBefore = articleJpaRepository.count();
        String slug = "preview-article-dry-run-" + System.currentTimeMillis();

        String previewPayload = """
                {
                  "slug": "%s",
                  "title": "Preview Article Dry Run",
                  "excerpt": "Đoạn mô tả ngắn xem trước.",
                  "body": "<p>Nội dung bài viết nháp.</p>",
                  "categoryId": "cc_blog",
                  "publishStatus": "DRAFT"
                }
                """.formatted(slug);

        // Returns the public Article shape, identical to GET /api/v1/articles/{slug}.
        mockMvc.perform(post("/api/v1/admin/content/articles/preview")
                        .contentType(MediaType.APPLICATION_JSON)
                        .characterEncoding(StandardCharsets.UTF_8)
                        .header("X-Admin-Permissions", "content.update")
                        .content(previewPayload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.title").value("Preview Article Dry Run"))
                .andExpect(jsonPath("$.data.slug").value(slug));

        // Dry-run must NOT persist: no new article row, slug never lands in the DB.
        assertThat(articleJpaRepository.count()).isEqualTo(countBefore);
        assertThat(articleJpaRepository.findBySlug(slug)).isEmpty();
    }

    @Test
    void shouldValidateProductMutationRules() throws Exception {
        String invalidSalePayload = """
                {
                  "slug": "phase4g-invalid-sale-%d",
                  "name": "Invalid Sale Product",
                  "categoryId": "cat_helmet",
                  "brandId": "brand_ls2",
                  "gender": "Unisex",
                  "sku": "INVALID-SALE",
                  "retailPrice": 1000000,
                  "salePrice": 1000000,
                  "stockState": "IN_STOCK",
                  "publishStatus": "DRAFT"
                }
                """.formatted(System.currentTimeMillis());

        mockMvc.perform(post("/api/v1/admin/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Admin-Permissions", "products.update")
                        .content(invalidSalePayload))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.details[0].field").value("salePrice"));

        String invalidMediaPayload = """
                {
                  "slug": "phase4g-invalid-media-%d",
                  "name": "Invalid Media Product",
                  "categoryId": "cat_helmet",
                  "brandId": "brand_ls2",
                  "gender": "Unisex",
                  "sku": "INVALID-MEDIA",
                  "retailPrice": 1000000,
                  "stockState": "IN_STOCK",
                  "publishStatus": "DRAFT",
                  "image": {
                    "url": "C:\\\\temp\\\\helmet.jpg"
                  }
                }
                """.formatted(System.currentTimeMillis());

        mockMvc.perform(post("/api/v1/admin/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Admin-Permissions", "products.update")
                        .content(invalidMediaPayload))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
    }

    @Test
    void shouldClearSeoFieldsWhenSeoPayloadIsNull() throws Exception {
        String suffix = String.valueOf(System.currentTimeMillis());
        String slug = "phase3-seo-content-" + suffix;
        String canonicalUrl = "https://bigbike.vn/products/" + slug;
        String imageUrl = MEDIA_PUBLIC_BASE_URL + "/wp-uploads/products/" + slug + "-seo.jpg";

        String createPayload = """
                {
                  "slug": "%s",
                  "name": "Phase 3 SEO Content Product %s",
                  "categoryId": "cat_helmet",
                  "brandId": "brand_ls2",
                  "gender": "Unisex",
                  "sku": "SEO-%s",
                  "retailPrice": 2500000,
                  "stockState": "IN_STOCK",
                  "publishStatus": "DRAFT",
                  "translations": {
                    "en": { "name": "Phase 3 SEO Content Product EN %s" }
                  },
                  "seo": {
                    "title": "Phase 3 SEO title %s",
                    "description": "Phase 3 SEO description %s",
                    "canonicalUrl": "%s",
                    "ogImage": {
                      "url": "%s",
                      "alt": "Phase 3 SEO OG image %s"
                    }
                  },
                  "image": {
                    "url": "%s/wp-uploads/products/%s.jpg",
                    "alt": "Phase 3 SEO Content Product"
                  }
                }
                """.formatted(
                slug,
                suffix,
                suffix,
                suffix,
                suffix,
                suffix,
                canonicalUrl,
                imageUrl,
                suffix,
                MEDIA_PUBLIC_BASE_URL,
                slug
        );

        mockMvc.perform(post("/api/v1/admin/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .characterEncoding(StandardCharsets.UTF_8)
                        .header("X-Admin-Permissions", "products.update")
                        .content(createPayload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.slug").value(slug))
                .andExpect(jsonPath("$.data.seo.title").value("Phase 3 SEO title " + suffix));

        ProductEntity created = productJpaRepository.findBySlug(slug)
                .orElseThrow(() -> new IllegalStateException("Expected created product."));

        assertThat(created.getSeoTitle()).isEqualTo("Phase 3 SEO title " + suffix);
        assertThat(created.getSeoDescription()).isEqualTo("Phase 3 SEO description " + suffix);
        assertThat(created.getSeoCanonicalUrl()).isEqualTo(canonicalUrl);
        assertThat(created.getSeoOgImageUrl()).isEqualTo(imageUrl);
        assertThat(created.getSeoOgImageAlt()).isEqualTo("Phase 3 SEO OG image " + suffix);

        String updatePayload = """
                {
                  "name": "Phase 3 SEO Content Product Updated %s",
                  "translations": {
                    "en": { "name": "Phase 3 SEO Content Product Updated EN %s" }
                  },
                  "seo": {
                    "title": "Phase 3 SEO title updated %s",
                    "description": "Phase 3 SEO description updated %s",
                    "canonicalUrl": "https://bigbike.vn/products/%s-updated",
                    "ogImage": {
                      "url": "%s/wp-uploads/products/%s-seo-updated.jpg",
                      "alt": "Phase 3 SEO OG image updated %s"
                    }
                  }
                }
                """.formatted(
                suffix,
                suffix,
                suffix,
                suffix,
                slug,
                MEDIA_PUBLIC_BASE_URL,
                slug,
                suffix
        );

        mockMvc.perform(patch("/api/v1/admin/products/{id}", created.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .characterEncoding(StandardCharsets.UTF_8)
                        .header("X-Admin-Permissions", "products.update")
                        .content(updatePayload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("Phase 3 SEO Content Product Updated " + suffix))
                .andExpect(jsonPath("$.data.seo.title").value("Phase 3 SEO title updated " + suffix));

        ProductEntity updated = productJpaRepository.findById(created.getId())
                .orElseThrow(() -> new IllegalStateException("Expected updated product."));
        assertThat(updated.getSeoTitle()).isEqualTo("Phase 3 SEO title updated " + suffix);
        assertThat(updated.getSeoDescription()).isEqualTo("Phase 3 SEO description updated " + suffix);
        assertThat(updated.getSeoCanonicalUrl()).isEqualTo("https://bigbike.vn/products/" + slug + "-updated");
        assertThat(updated.getSeoOgImageUrl()).isEqualTo(MEDIA_PUBLIC_BASE_URL + "/wp-uploads/products/" + slug + "-seo-updated.jpg");
        assertThat(updated.getSeoOgImageAlt()).isEqualTo("Phase 3 SEO OG image updated " + suffix);

        mockMvc.perform(patch("/api/v1/admin/products/{id}", created.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .characterEncoding(StandardCharsets.UTF_8)
                        .header("X-Admin-Permissions", "products.update")
                        .content("""
                                {
                                  "seo": null,
                                  "translations": {
                                    "en": { "name": "Phase 3 SEO Content Product Cleared EN" }
                                  }
                                }
                                """))
                .andExpect(status().isOk());

        ProductEntity seoCleared = productJpaRepository.findById(created.getId())
                .orElseThrow(() -> new IllegalStateException("Expected SEO-cleared product."));
        assertThat(seoCleared.getSeoTitle()).isNull();
        assertThat(seoCleared.getSeoDescription()).isNull();
        assertThat(seoCleared.getSeoCanonicalUrl()).isNull();
        assertThat(seoCleared.getSeoOgImageUrl()).isNull();
        assertThat(seoCleared.getSeoOgImageAlt()).isNull();
    }

    @Test
    void updateProductShouldNotWipeVariantPricesWhenVariantPriceFieldsAreAbsent() throws Exception {
        String suffix = String.valueOf(System.currentTimeMillis());

        UpsertProductRequest create = new UpsertProductRequest();
        create.setSlug("phase1-variant-price-" + suffix);
        create.setName("Phase 1 Variant Price Product " + suffix);
        create.setCategoryId("cat_helmet");
        create.setBrandId("brand_ls2");
        create.setGender("Unisex");
        create.setRetailPrice(new BigDecimal("2500000"));
        create.setSalePrice(new BigDecimal("2300000"));
        create.setCurrency("VND");
        create.setPublishStatus(PublishStatus.DRAFT);
        create.setSku("phase1-variant-price-" + suffix);
        create.setTranslations(new ProductTranslationRequest(
                ProductTranslationRequest.ProductContentRequest.builder()
                        .name("Phase 1 Variant Price Product EN " + suffix)
                        .build()));

        VariantRequest variant = new VariantRequest();
        variant.setSku("VAR-" + suffix);
        variant.setRetailPrice(new BigDecimal("1800000"));
        variant.setSalePrice(new BigDecimal("1700000"));
        variant.setIsAvailable(true);
        variant.setSortOrder(0);
        variant.setOptions(List.of(variantOption("Size", "M")));
        variant.setGallery(List.of());
        create.setVariants(List.of(variant));

        var saved = productMutationService.createProduct(create, DEV_ADMIN_ID);
        String productId = saved.id();
        String variantId = saved.variants().get(0).id();

        String updatePayload = """
                {
                  "name": "Phase 1 Variant Price Product Updated %s",
                  "categoryId": "cat_helmet",
                  "retailPrice": 2500000,
                  "salePrice": 2300000,
                  "currency": "VND",
                  "stockState": "IN_STOCK",
                  "publishStatus": "DRAFT",
                  "translations": {
                    "en": { "name": "Phase 1 Variant Price Product Updated EN %s" }
                  },
                  "variants": [
                    {
                      "id": "%s",
                      "sku": "VAR-%s",
                      "name": "Black / M Updated",
                      "stockState": "IN_STOCK",
                      "imageUrl": "",
                      "isAvailable": true,
                      "sortOrder": 0,
                      "options": [
                        { "optionName": "Size", "optionValue": "M" }
                      ],
                      "gallery": []
                    }
                  ]
                }
                """.formatted(suffix, suffix, variantId, suffix);

        mockMvc.perform(patch("/api/v1/admin/products/{id}", productId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .characterEncoding(StandardCharsets.UTF_8)
                        .header("X-Admin-Permissions", "products.update")
                        .content(updatePayload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("Phase 1 Variant Price Product Updated " + suffix));

        ProductVariantEntity updatedVariant = productVariantJpaRepository.findById(variantId)
                .orElseThrow(() -> new IllegalStateException("Expected updated variant."));
        assertThat(updatedVariant.getRetailPrice()).isEqualByComparingTo("1800000");
        assertThat(updatedVariant.getSalePrice()).isEqualByComparingTo("1700000");
    }

    @Test
    void shouldSoftDeleteProductIdempotentlyAndRestoreTrashToDraft() throws Exception {
        String suffix = String.valueOf(System.currentTimeMillis());
        String slug = "phase2-trash-product-" + suffix;

        String createPayload = """
                  {
                    "slug": "%s",
                    "name": "Phase 2 Trash Product %s",
                    "categoryId": "cat_helmet",
                    "brandId": "brand_ls2",
                    "gender": "Unisex",
                    "sku": "TRASH-%s",
                    "retailPrice": 1250000,
                    "stockState": "IN_STOCK",
                    "publishStatus": "DRAFT",
                    "translations": {
                      "en": { "name": "Phase 2 Trash Product EN %s" }
                    },
                    "image": {
                      "url": "%s/wp-uploads/products/%s.jpg",
                      "alt": "Phase 2 Trash Product"
                    }
                  }
                  """.formatted(slug, suffix, suffix, suffix, MEDIA_PUBLIC_BASE_URL, slug);

        mockMvc.perform(post("/api/v1/admin/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .characterEncoding(StandardCharsets.UTF_8)
                        .header("X-Admin-Permissions", "products.update")
                        .content(createPayload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.slug").value(slug))
                .andExpect(jsonPath("$.data.publishStatus").value("DRAFT"));

        ProductEntity created = productJpaRepository.findBySlug(slug)
                .orElseThrow(() -> new IllegalStateException("Expected created product."));

        mockMvc.perform(delete("/api/v1/admin/products/{id}", created.getId())
                        .header("X-Admin-Permissions", "products.update"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.publishStatus").value("TRASH"));

        mockMvc.perform(delete("/api/v1/admin/products/{id}", created.getId())
                        .header("X-Admin-Permissions", "products.update"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.publishStatus").value("TRASH"));

        mockMvc.perform(post("/api/v1/admin/products/{id}/restore", created.getId())
                        .header("X-Admin-Permissions", "products.update"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.publishStatus").value("DRAFT"));
    }

    @Test
    void restoreProductShouldRequireProductsUpdatePermission() throws Exception {
        String suffix = String.valueOf(System.currentTimeMillis());
        String slug = "phase2-restore-permission-" + suffix;

        String createPayload = """
                  {
                    "slug": "%s",
                    "name": "Phase 2 Restore Permission Product %s",
                    "categoryId": "cat_helmet",
                    "brandId": "brand_ls2",
                    "gender": "Unisex",
                    "sku": "RESTORE-%s",
                    "retailPrice": 1250000,
                    "stockState": "IN_STOCK",
                    "publishStatus": "DRAFT",
                    "translations": {
                      "en": { "name": "Phase 2 Restore Permission Product EN %s" }
                    },
                    "image": {
                      "url": "%s/wp-uploads/products/%s.jpg",
                      "alt": "Phase 2 Restore Permission Product"
                    }
                  }
                  """.formatted(slug, suffix, suffix, suffix, MEDIA_PUBLIC_BASE_URL, slug);

        mockMvc.perform(post("/api/v1/admin/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .characterEncoding(StandardCharsets.UTF_8)
                        .header("X-Admin-Permissions", "products.update")
                        .content(createPayload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.slug").value(slug))
                .andExpect(jsonPath("$.data.publishStatus").value("DRAFT"));

        ProductEntity created = productJpaRepository.findBySlug(slug)
                .orElseThrow(() -> new IllegalStateException("Expected created product."));

        mockMvc.perform(delete("/api/v1/admin/products/{id}", created.getId())
                        .header("X-Admin-Permissions", "products.update"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.publishStatus").value("TRASH"));

        mockMvc.perform(post("/api/v1/admin/products/{id}/restore", created.getId())
                        .header("X-Admin-Permissions", "products.read"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("FORBIDDEN"));
    }

    @Test
    void shouldCreateAndUpdateCategoryBrandAndContent() throws Exception {
        String suffix = String.valueOf(System.currentTimeMillis());

        String categorySlug = "phase4g-category-" + suffix;
        mockMvc.perform(post("/api/v1/admin/categories")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Admin-Permissions", "catalog.update")
                        .content("""
                                {
                                  "slug": "%s",
                                  "name": "Phase 4G Category %s",
                                  "description": "Category from mutation test",
                                  "visible": true,
                                  "translations": {
                                    "en": { "name": "Phase 4G Category EN %s" }
                                  }
                                }
                                """.formatted(categorySlug, suffix, suffix)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.slug").value(categorySlug));

        CategoryEntity category = categoryJpaRepository.findBySlug(categorySlug)
                .orElseThrow(() -> new IllegalStateException("Expected created category."));

        mockMvc.perform(patch("/api/v1/admin/categories/{id}", category.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Admin-Permissions", "catalog.update")
                        .content("""
                                {
                                  "name": "Phase 4G Category Updated %s",
                                  "visible": false,
                                  "translations": {
                                    "en": { "name": "Phase 4G Category Updated EN %s" }
                                  }
                                }
                                """.formatted(suffix, suffix)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.isVisible").value(false));

        String brandSlug = "phase4g-brand-" + suffix;
        mockMvc.perform(post("/api/v1/admin/brands")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Admin-Permissions", "catalog.update")
                        .content("""
                                {
                                  "slug": "%s",
                                  "name": "Phase 4G Brand %s",
                                  "description": "Brand from mutation test",
                                  "showOnHomepage": true,
                                  "translations": {
                                    "en": { "description": "Phase 4G Brand EN %s" }
                                  }
                                }
                                """.formatted(brandSlug, suffix, suffix)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.slug").value(brandSlug));

        BrandEntity brand = brandJpaRepository.findBySlug(brandSlug)
                .orElseThrow(() -> new IllegalStateException("Expected created brand."));

        mockMvc.perform(patch("/api/v1/admin/brands/{id}", brand.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Admin-Permissions", "catalog.update")
                        .content("""
                                {
                                  "name": "Phase 4G Brand Updated %s",
                                  "showOnHomepage": false,
                                  "translations": {
                                    "en": { "description": "Phase 4G Brand Updated EN %s" }
                                  }
                                }
                """.formatted(suffix, suffix)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.isVisible").value(true))
                .andExpect(jsonPath("$.data.showOnHomepage").value(false));

        String articleSlug = "phase4g-article-" + suffix;
        mockMvc.perform(post("/api/v1/admin/content/articles")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Admin-Permissions", "content.update")
                        .content("""
                                {
                                  "slug": "%s",
                                  "title": "Phase 4G Article %s",
                                  "excerpt": "Mutation test article",
                                  "body": "<p>Article body</p>",
                                  "publishStatus": "DRAFT",
                                  "translations": {
                                    "en": { "title": "Phase 4G Article EN %s" }
                                  }
                                }
                                """.formatted(articleSlug, suffix, suffix)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.type").value("ARTICLE"))
                .andExpect(jsonPath("$.data.slug").value(articleSlug));

        ArticleEntity article = articleJpaRepository.findBySlug(articleSlug)
                .orElseThrow(() -> new IllegalStateException("Expected created article."));

        mockMvc.perform(patch("/api/v1/admin/content/articles/{id}", article.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Admin-Permissions", "content.update")
                        .content("""
                                {
                                  "title": "Phase 4G Article Updated %s",
                                  "publishStatus": "PUBLISHED",
                                  "translations": {
                                    "en": { "title": "Phase 4G Article Updated EN %s" }
                                  }
                                }
                                """.formatted(suffix, suffix)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.publishStatus").value("PUBLISHED"));
    }

    @Test
    void shouldReturnForbiddenWhenMutationPermissionMissing() throws Exception {
        mockMvc.perform(post("/api/v1/admin/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Admin-Permissions", "products.read")
                        .content("""
                                {
                                  "slug": "phase4g-no-permission",
                                  "name": "No Permission Product",
                                  "categoryId": "cat_helmet",
                                  "retailPrice": 1000000,
                                  "stockState": "IN_STOCK",
                                  "publishStatus": "DRAFT"
                                }
                                """))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("FORBIDDEN"));
    }

    // ── Category hide-guard tests ─────────────────────────────────────────────

    @Test
    void deleteCategoryWithChildrenButNoProductsShouldCascade() throws Exception {
        // CATEGORY_RULE_004: deleting a category cascades to its whole sub-tree
        // when no category in the tree has products assigned.
        String suffix = String.valueOf(System.currentTimeMillis());
        String parentSlug = "cascade-del-parent-" + suffix;
        String childSlug = "cascade-del-child-" + suffix;

        mockMvc.perform(post("/api/v1/admin/categories")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Admin-Permissions", "catalog.update")
                        .content("""
                                {"slug":"%s","name":"Cascade Del Parent %s","visible":true,"translations":{"en":{"name":"Cascade Del Parent EN %s"}}}
                                """.formatted(parentSlug, suffix, suffix)))
                .andExpect(status().isOk());

        CategoryEntity parent = categoryJpaRepository.findBySlug(parentSlug)
                .orElseThrow(() -> new IllegalStateException("Expected parent category."));

        mockMvc.perform(post("/api/v1/admin/categories")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Admin-Permissions", "catalog.update")
                        .content("""
                                {"slug":"%s","name":"Cascade Del Child %s","parentId":"%s","visible":true,"translations":{"en":{"name":"Cascade Del Child EN %s"}}}
                                """.formatted(childSlug, suffix, parent.getId(), suffix)))
                .andExpect(status().isOk());

        CategoryEntity child = categoryJpaRepository.findBySlug(childSlug)
                .orElseThrow(() -> new IllegalStateException("Expected child category."));

        mockMvc.perform(delete("/api/v1/admin/categories/{id}", parent.getId())
                        .header("X-Admin-Permissions", "catalog.update"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.deleted").value(true));

        assertThat(categoryJpaRepository.findById(parent.getId()).orElseThrow().isDeleted()).isTrue();
        assertThat(categoryJpaRepository.findById(child.getId()).orElseThrow().isDeleted()).isTrue();
    }

    @Test
    void deleteCategoryWithProductInSubtreeShouldSoftDeleteWithoutReassignment() throws Exception {
        // CATEGORY_RULE_004: soft delete keeps product links and cascades the tree.
        String suffix = String.valueOf(System.currentTimeMillis());
        String parentSlug = "prodblock-del-parent-" + suffix;
        String childSlug = "prodblock-del-child-" + suffix;
        String productSlug = "prodblock-del-product-" + suffix;

        mockMvc.perform(post("/api/v1/admin/categories")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Admin-Permissions", "catalog.update")
                        .content("""
                                {"slug":"%s","name":"ProdBlock Del Parent %s","visible":true,"translations":{"en":{"name":"ProdBlock Del Parent EN %s"}}}
                                """.formatted(parentSlug, suffix, suffix)))
                .andExpect(status().isOk());

        CategoryEntity parent = categoryJpaRepository.findBySlug(parentSlug)
                .orElseThrow(() -> new IllegalStateException("Expected parent category."));

        mockMvc.perform(post("/api/v1/admin/categories")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Admin-Permissions", "catalog.update")
                        .content("""
                                {"slug":"%s","name":"ProdBlock Del Child %s","parentId":"%s","visible":true,"translations":{"en":{"name":"ProdBlock Del Child EN %s"}}}
                                """.formatted(childSlug, suffix, parent.getId(), suffix)))
                .andExpect(status().isOk());

        CategoryEntity child = categoryJpaRepository.findBySlug(childSlug)
                .orElseThrow(() -> new IllegalStateException("Expected child category."));

        // Assign a product to the CHILD category (deeper in the sub-tree).
        mockMvc.perform(post("/api/v1/admin/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .characterEncoding(StandardCharsets.UTF_8)
                        .header("X-Admin-Permissions", "products.update")
                        .content("""
                                {
                                  "slug": "%s",
                                  "name": "ProdBlock Del Product %s",
                                  "sku": "CAT-SOFT-%s",
                                  "categoryId": "%s",
                                  "brandId": "brand_ls2",
                                  "gender": "MEN",
                                  "retailPrice": 1000000,
                                  "stockState": "IN_STOCK",
                                  "publishStatus": "DRAFT",
                                  "translations": { "en": { "name": "ProdBlock Del Product EN %s" } },
                                  "image": { "url": "%s/wp-uploads/products/%s.jpg", "alt": "p" }
                                }
                                """.formatted(productSlug, suffix, suffix, child.getId(), suffix, MEDIA_PUBLIC_BASE_URL, productSlug)))
                .andExpect(status().isOk());

        mockMvc.perform(delete("/api/v1/admin/categories/{id}", parent.getId())
                        .header("X-Admin-Permissions", "catalog.update"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.deleted").value(true));

        assertThat(categoryJpaRepository.findById(parent.getId()).orElseThrow().isDeleted()).isTrue();
        assertThat(categoryJpaRepository.findById(child.getId()).orElseThrow().isDeleted()).isTrue();
    }

    @Test
    void patchCategoryVisibleFalseWithVisibleChildShouldReturnConflict() throws Exception {
        String suffix = String.valueOf(System.currentTimeMillis());
        String parentSlug = "hide-guard-patch-parent-" + suffix;
        String childSlug = "hide-guard-patch-child-" + suffix;

        mockMvc.perform(post("/api/v1/admin/categories")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Admin-Permissions", "catalog.update")
                        .content("""
                                {"slug":"%s","name":"Hide Guard Patch Parent %s","visible":true,"translations":{"en":{"name":"Hide Guard Patch Parent EN %s"}}}
                                """.formatted(parentSlug, suffix, suffix)))
                .andExpect(status().isOk());

        CategoryEntity parent = categoryJpaRepository.findBySlug(parentSlug)
                .orElseThrow(() -> new IllegalStateException("Expected parent category."));

        mockMvc.perform(post("/api/v1/admin/categories")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Admin-Permissions", "catalog.update")
                        .content("""
                                {"slug":"%s","name":"Hide Guard Patch Child %s","parentId":"%s","visible":true,"translations":{"en":{"name":"Hide Guard Patch Child EN %s"}}}
                                """.formatted(childSlug, suffix, parent.getId(), suffix)))
                .andExpect(status().isOk());

        mockMvc.perform(patch("/api/v1/admin/categories/{id}", parent.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Admin-Permissions", "catalog.update")
                        .content("""
                                {"visible":false,"translations":{"en":{"name":"Hide Guard Patch Parent EN %s"}}}
                                """.formatted(suffix)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("CONFLICT"));

        CategoryEntity stillVisible = categoryJpaRepository.findById(parent.getId())
                .orElseThrow(() -> new IllegalStateException("Expected parent category."));
        assertThat(stillVisible.isVisible()).isTrue();
    }

    @Test
    void patchCategoryVisibleFalseWithNoVisibleChildShouldSucceed() throws Exception {
        String suffix = String.valueOf(System.currentTimeMillis());
        String parentSlug = "hide-guard-no-child-" + suffix;

        mockMvc.perform(post("/api/v1/admin/categories")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Admin-Permissions", "catalog.update")
                        .content("""
                                {"slug":"%s","name":"Hide Guard No Child %s","visible":true,"translations":{"en":{"name":"Hide Guard No Child EN %s"}}}
                                """.formatted(parentSlug, suffix, suffix)))
                .andExpect(status().isOk());

        CategoryEntity parent = categoryJpaRepository.findBySlug(parentSlug)
                .orElseThrow(() -> new IllegalStateException("Expected parent category."));

        mockMvc.perform(patch("/api/v1/admin/categories/{id}", parent.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Admin-Permissions", "catalog.update")
                        .content("""
                                {"visible":false,"translations":{"en":{"name":"Hide Guard No Child EN %s"}}}
                                """.formatted(suffix)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.isVisible").value(false));

        CategoryEntity hidden = categoryJpaRepository.findById(parent.getId())
                .orElseThrow(() -> new IllegalStateException("Expected parent category."));
        assertThat(hidden.isVisible()).isFalse();
    }

    @Test
    void patchHiddenCategoryVisibleTrueShouldRestoreCategory() throws Exception {
        String suffix = String.valueOf(System.currentTimeMillis());
        String slug = "hide-guard-restore-" + suffix;

        mockMvc.perform(post("/api/v1/admin/categories")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Admin-Permissions", "catalog.update")
                        .content("""
                                {"slug":"%s","name":"Hide Guard Restore %s","visible":true,"translations":{"en":{"name":"Hide Guard Restore EN %s"}}}
                                """.formatted(slug, suffix, suffix)))
                .andExpect(status().isOk());

        CategoryEntity category = categoryJpaRepository.findBySlug(slug)
                .orElseThrow(() -> new IllegalStateException("Expected category."));

        mockMvc.perform(patch("/api/v1/admin/categories/{id}", category.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Admin-Permissions", "catalog.update")
                        .content("""
                                {"visible":false,"translations":{"en":{"name":"Hide Guard Restore EN %s"}}}
                                """.formatted(suffix)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.isVisible").value(false));

        mockMvc.perform(patch("/api/v1/admin/categories/{id}", category.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Admin-Permissions", "catalog.update")
                        .content("""
                                {"visible":true,"translations":{"en":{"name":"Hide Guard Restore EN %s"}}}
                                """.formatted(suffix)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.isVisible").value(true));

        CategoryEntity restored = categoryJpaRepository.findById(category.getId())
                .orElseThrow(() -> new IllegalStateException("Expected category."));
        assertThat(restored.isVisible()).isTrue();
    }

    @Test
    void categoryBannerShouldRejectUrlOutsideTheMediaLibrary() throws Exception {
        String suffix = String.valueOf(System.currentTimeMillis());

        mockMvc.perform(post("/api/v1/admin/categories")
                        .contentType(MediaType.APPLICATION_JSON)
                        .characterEncoding(StandardCharsets.UTF_8)
                        .header("X-Admin-Permissions", "catalog.update")
                        .content("""
                                {
                                  "slug":"cat-banner-external-%s",
                                  "name":"Danh mục banner ngoài %s",
                                  "translations":{"en":{"name":"External banner category %s"}},
                                  "banner":{"url":"https://cdn.ben-thu-ba.com/hero.jpg"}
                                }
                                """.formatted(suffix, suffix, suffix)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.details[0].field").value("banner.url"))
                .andExpect(jsonPath("$.error.details[0].code").value("INVALID_VALUE"));

        mockMvc.perform(post("/api/v1/admin/categories")
                        .contentType(MediaType.APPLICATION_JSON)
                        .characterEncoding(StandardCharsets.UTF_8)
                        .header("X-Admin-Permissions", "catalog.update")
                        .content("""
                                {
                                  "slug":"cat-mobile-banner-external-%s",
                                  "name":"Danh mục banner mobile ngoài %s",
                                  "translations":{"en":{"name":"External mobile banner category %s"}},
                                  "mobileBanner":{"url":"https://cdn.ben-thu-ba.com/hero-mobile.jpg"}
                                }
                                """.formatted(suffix, suffix, suffix)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.details[0].field").value("mobileBanner.url"));
    }

    @Test
    void categoryShouldAllowClearingDescriptionAndIntroContent() throws Exception {
        String suffix = String.valueOf(System.currentTimeMillis());
        String slug = "cat-clear-desc-" + suffix;

        mockMvc.perform(post("/api/v1/admin/categories")
                        .contentType(MediaType.APPLICATION_JSON)
                        .characterEncoding(StandardCharsets.UTF_8)
                        .header("X-Admin-Permissions", "catalog.update")
                        .content("""
                                {
                                  "slug":"%s",
                                  "name":"Danh mục mô tả %s",
                                  "description":"<p>Mô tả ban đầu</p>",
                                  "introContent":"<p>Giới thiệu ban đầu</p>",
                                  "translations":{"en":{"name":"Description category %s"}}
                                }
                                """.formatted(slug, suffix, suffix)))
                .andExpect(status().isOk());

        CategoryEntity created = categoryJpaRepository.findBySlug(slug).orElseThrow();
        assertThat(created.getDescription()).isEqualTo("<p>Mô tả ban đầu</p>");
        assertThat(created.getIntroContent()).isEqualTo("<p>Giới thiệu ban đầu</p>");

        // Chuỗi rỗng = xóa (presence-flag): admin phải xoá được mô tả + khối giới thiệu cũ.
        mockMvc.perform(patch("/api/v1/admin/categories/{id}", created.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .characterEncoding(StandardCharsets.UTF_8)
                        .header("X-Admin-Permissions", "catalog.update")
                        .content("""
                                {"description":"","introContent":"","translations":{"en":{"name":"Description category %s"}}}
                                """.formatted(suffix)))
                .andExpect(status().isOk());

        CategoryEntity cleared = categoryJpaRepository.findById(created.getId()).orElseThrow();
        assertThat(cleared.getDescription()).isNull();
        assertThat(cleared.getIntroContent()).isNull();
    }

    @Test
    void patchCategoryVisibleFalseWithHiddenChildShouldSucceed() throws Exception {
        String suffix = String.valueOf(System.currentTimeMillis());
        String parentSlug = "hide-guard-hidden-child-parent-" + suffix;
        String childSlug = "hide-guard-hidden-child-child-" + suffix;

        mockMvc.perform(post("/api/v1/admin/categories")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Admin-Permissions", "catalog.update")
                        .content("""
                                {"slug":"%s","name":"Hide Guard Hidden Child Parent %s","visible":true,"translations":{"en":{"name":"Hide Guard Hidden Child Parent EN %s"}}}
                                """.formatted(parentSlug, suffix, suffix)))
                .andExpect(status().isOk());

        CategoryEntity parent = categoryJpaRepository.findBySlug(parentSlug)
                .orElseThrow(() -> new IllegalStateException("Expected parent category."));

        mockMvc.perform(post("/api/v1/admin/categories")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Admin-Permissions", "catalog.update")
                        .content("""
                                {"slug":"%s","name":"Hide Guard Hidden Child %s","parentId":"%s","visible":false,"translations":{"en":{"name":"Hide Guard Hidden Child EN %s"}}}
                                """.formatted(childSlug, suffix, parent.getId(), suffix)))
                .andExpect(status().isOk());

        mockMvc.perform(patch("/api/v1/admin/categories/{id}", parent.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Admin-Permissions", "catalog.update")
                        .content("""
                                {"visible":false,"translations":{"en":{"name":"Hide Guard Hidden Child Parent EN %s"}}}
                                """.formatted(suffix)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.isVisible").value(false));

        CategoryEntity hidden = categoryJpaRepository.findById(parent.getId())
                .orElseThrow(() -> new IllegalStateException("Expected parent category."));
        assertThat(hidden.isVisible()).isFalse();
    }

    @Test
    void patchCategoryNameOnlyWithVisibleChildShouldNotTriggerHideGuard() throws Exception {
        String suffix = String.valueOf(System.currentTimeMillis());
        String parentSlug = "hide-guard-name-only-parent-" + suffix;
        String childSlug = "hide-guard-name-only-child-" + suffix;

        mockMvc.perform(post("/api/v1/admin/categories")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Admin-Permissions", "catalog.update")
                        .content("""
                                {"slug":"%s","name":"Hide Guard Name Only Parent %s","visible":true,"translations":{"en":{"name":"Hide Guard Name Only Parent EN %s"}}}
                                """.formatted(parentSlug, suffix, suffix)))
                .andExpect(status().isOk());

        CategoryEntity parent = categoryJpaRepository.findBySlug(parentSlug)
                .orElseThrow(() -> new IllegalStateException("Expected parent category."));

        mockMvc.perform(post("/api/v1/admin/categories")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Admin-Permissions", "catalog.update")
                        .content("""
                                {"slug":"%s","name":"Hide Guard Name Only Child %s","parentId":"%s","visible":true,"translations":{"en":{"name":"Hide Guard Name Only Child EN %s"}}}
                                """.formatted(childSlug, suffix, parent.getId(), suffix)))
                .andExpect(status().isOk());

        mockMvc.perform(patch("/api/v1/admin/categories/{id}", parent.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Admin-Permissions", "catalog.update")
                        .content("""
                                {"name":"Hide Guard Name Only Parent Updated %s","translations":{"en":{"name":"Hide Guard Name Only Parent Updated EN %s"}}}
                                """.formatted(suffix, suffix)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.isVisible").value(true));

        CategoryEntity updated = categoryJpaRepository.findById(parent.getId())
                .orElseThrow(() -> new IllegalStateException("Expected parent category."));
        assertThat(updated.isVisible()).isTrue();
        assertThat(updated.getName()).isEqualTo("Hide Guard Name Only Parent Updated " + suffix);
    }

    @Test
    void categorySeoOgImageShouldRoundTripAndClearViaEmptyFields() throws Exception {
        String suffix = String.valueOf(System.currentTimeMillis());
        String slug = "category-seo-og-" + suffix;
        String ogUrl = MEDIA_PUBLIC_BASE_URL + "/wp-uploads/categories/" + slug + "-og.jpg";

        mockMvc.perform(post("/api/v1/admin/categories")
                        .contentType(MediaType.APPLICATION_JSON)
                        .characterEncoding(StandardCharsets.UTF_8)
                        .header("X-Admin-Permissions", "catalog.update")
                        .content("""
                                {
                                  "slug":"%s",
                                  "name":"Category SEO OG %s",
                                  "visible":true,
                                  "translations":{"en":{"name":"Category SEO OG EN %s"}},
                                  "seo":{
                                    "title":"Cat SEO title %s",
                                    "description":"Cat SEO desc %s",
                                    "canonicalUrl":"https://bigbike.vn/danh-muc/%s",
                                    "ogImage":{"url":"%s","alt":"Cat OG alt %s"}
                                  }
                                }
                                """.formatted(slug, suffix, suffix, suffix, suffix, slug, ogUrl, suffix)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.seo.title").value("Cat SEO title " + suffix))
                .andExpect(jsonPath("$.data.seo.ogImage.url").value(ogUrl))
                .andExpect(jsonPath("$.data.seo.ogImage.alt").value("Cat OG alt " + suffix));

        CategoryEntity created = categoryJpaRepository.findBySlug(slug)
                .orElseThrow(() -> new IllegalStateException("Expected created category."));
        assertThat(created.getSeoTitle()).isEqualTo("Cat SEO title " + suffix);
        assertThat(created.getSeoOgImageUrl()).isEqualTo(ogUrl);
        assertThat(created.getSeoOgImageAlt()).isEqualTo("Cat OG alt " + suffix);

        // Reload via GET — verify the same shape comes back
        mockMvc.perform(get("/api/v1/admin/categories/{id}", created.getId())
                        .header("X-Admin-Permissions", "catalog.read"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.seo.ogImage.url").value(ogUrl))
                .andExpect(jsonPath("$.data.seo.ogImage.alt").value("Cat OG alt " + suffix));

        // Clear SEO via empty fields + ogImage:null (Category PATCH supports field-level clear via applySeo)
        mockMvc.perform(patch("/api/v1/admin/categories/{id}", created.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .characterEncoding(StandardCharsets.UTF_8)
                        .header("X-Admin-Permissions", "catalog.update")
                        .content("""
                                {"seo":{"ogImage":null},"translations":{"en":{"name":"Category SEO OG EN %s"}}}
                                """.formatted(suffix)))
                .andExpect(status().isOk());

        CategoryEntity cleared = categoryJpaRepository.findById(created.getId())
                .orElseThrow(() -> new IllegalStateException("Expected SEO-cleared category."));
        assertThat(cleared.getSeoTitle()).isNull();
        assertThat(cleared.getSeoDescription()).isNull();
        assertThat(cleared.getSeoCanonicalUrl()).isNull();
        assertThat(cleared.getSeoOgImageUrl()).isNull();
        assertThat(cleared.getSeoOgImageAlt()).isNull();
    }

    @Test
    void shouldKeepCategoryHomepageIndependentAndLockSystemCategoryRestore() throws Exception {
        String suffix = String.valueOf(System.currentTimeMillis());
        String slug = "category-homepage-" + suffix;

        mockMvc.perform(post("/api/v1/admin/categories")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Admin-Permissions", "catalog.update")
                        .content("""
                                {"slug":"%s","name":"Category Homepage %s","translations":{"en":{"name":"Category Homepage EN %s"}}}
                                """.formatted(slug, suffix, suffix)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.showOnHomepage").value(false));

        CategoryEntity category = categoryJpaRepository.findBySlug(slug).orElseThrow();
        mockMvc.perform(patch("/api/v1/admin/categories/{id}", category.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Admin-Permissions", "catalog.update")
                        .content("{" + "\"showOnHomepage\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.showOnHomepage").value(true))
                .andExpect(jsonPath("$.data.isVisible").value(true));

        mockMvc.perform(post("/api/v1/admin/categories/{id}/restore", "uncategorized")
                        .header("X-Admin-Permissions", "catalog.update"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("CONFLICT"));
    }

    // ── Brand hardening tests ─────────────────────────────────────────────────

    @Test
    void brandSeoShouldClearWhenPatchSuppliesEmptySeoObject() throws Exception {
        String suffix = String.valueOf(System.currentTimeMillis());
        String slug = "brand-clear-seo-" + suffix;

        mockMvc.perform(post("/api/v1/admin/brands")
                        .contentType(MediaType.APPLICATION_JSON)
                        .characterEncoding(StandardCharsets.UTF_8)
                        .header("X-Admin-Permissions", "catalog.update")
                        .content("""
                                {
                                  "slug":"%s",
                                  "name":"Thương hiệu SEO %s",
                                  "seo":{
                                    "title":"Tiêu đề cũ",
                                    "description":"Mô tả cũ",
                                    "canonicalUrl":"https://bigbike.vn/brands/%s",
                                    "ogImage":{"url":"%s/brands/seo.jpg","alt":"Ảnh cũ"}
                                  },
                                  "translations":{"en":{"description":"English SEO description"}}
                                }
                                """.formatted(slug, suffix, slug, MEDIA_PUBLIC_BASE_URL, suffix)))
                .andExpect(status().isOk());

        BrandEntity brand = brandJpaRepository.findBySlug(slug).orElseThrow();
        assertThat(brand.getSeoTitle()).isEqualTo("Tiêu đề cũ");

        mockMvc.perform(patch("/api/v1/admin/brands/{id}", brand.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .characterEncoding(StandardCharsets.UTF_8)
                        .header("X-Admin-Permissions", "catalog.update")
                        .content("""
                                {"seo":{},"translations":{"en":{"description":"English SEO description"}}}
                                """.formatted(suffix)))
                .andExpect(status().isOk());

        BrandEntity cleared = brandJpaRepository.findById(brand.getId()).orElseThrow();
        assertThat(cleared.getSeoTitle()).isNull();
        assertThat(cleared.getSeoDescription()).isNull();
        assertThat(cleared.getSeoCanonicalUrl()).isNull();
        assertThat(cleared.getSeoOgImageUrl()).isNull();
    }

    // ── Featured-grid placement (PRODUCT_RULE_015) ────────────────────────────

    /** Creates a fully-populated product and publishes it, returning the persisted entity. */
    private ProductEntity createPublishedProduct(String slug, String suffix) throws Exception {
        mockMvc.perform(post("/api/v1/admin/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .characterEncoding(StandardCharsets.UTF_8)
                        .header("X-Admin-Permissions", "products.update")
                        .content("""
                                {
                                  "slug": "%s",
                                  "name": "Sản phẩm nổi bật %s",
                                  "categoryId": "cat_helmet",
                                  "brandId": "brand_ls2",
                                  "gender": "Unisex",
                                  "sku": "FEATURED-%s",
                                  "retailPrice": 2500000,
                                  "currency": "VND",
                                  "publishStatus": "DRAFT",
                                  "translations": { "en": { "name": "Featured product %s" } },
                                  "image": { "url": "%s/wp-uploads/products/%s.jpg", "alt": "Ảnh sản phẩm" }
                                }
                                """.formatted(slug, suffix, suffix, suffix, MEDIA_PUBLIC_BASE_URL, slug)))
                .andExpect(status().isOk());

        ProductEntity created = productJpaRepository.findBySlug(slug).orElseThrow();

        mockMvc.perform(patch("/api/v1/admin/products/{id}/publish", created.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .characterEncoding(StandardCharsets.UTF_8)
                        .header("X-Admin-Permissions", "products.update")
                        .content("{\"publishStatus\":\"PUBLISHED\"}"))
                .andExpect(status().isOk());

        return productJpaRepository.findById(created.getId()).orElseThrow();
    }

    private void pinToFeaturedGrid(String productId) throws Exception {
        mockMvc.perform(post("/api/v1/admin/products/homepage-blocks")
                        .contentType(MediaType.APPLICATION_JSON)
                        .characterEncoding(StandardCharsets.UTF_8)
                        .header("X-Admin-Permissions", "products.update")
                        .content("{\"featuredGrid\":[\"%s\"]}".formatted(productId)))
                .andExpect(status().isOk());
        assertThat(productJpaRepository.findById(productId).orElseThrow().getHomepageBlock())
                .isEqualTo(HomepageBlock.FEATURED_GRID);
    }

    @Test
    void unpublishingAProductShouldDropItFromTheFeaturedGrid() throws Exception {
        String suffix = String.valueOf(System.currentTimeMillis());
        String slug = "featured-unpublish-" + suffix;

        ProductEntity product = createPublishedProduct(slug, suffix);
        pinToFeaturedGrid(product.getId());

        mockMvc.perform(patch("/api/v1/admin/products/{id}/publish", product.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .characterEncoding(StandardCharsets.UTF_8)
                        .header("X-Admin-Permissions", "products.update")
                        .content("{\"publishStatus\":\"DRAFT\"}"))
                .andExpect(status().isOk());

        ProductEntity unpublished = productJpaRepository.findById(product.getId()).orElseThrow();
        assertThat(unpublished.getHomepageBlock()).isEqualTo(HomepageBlock.NONE);
        assertThat(unpublished.getHomepageOrder()).isNull();

        // Đăng bán lại KHÔNG tự đưa sản phẩm trở lại khối nổi bật.
        mockMvc.perform(patch("/api/v1/admin/products/{id}/publish", product.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .characterEncoding(StandardCharsets.UTF_8)
                        .header("X-Admin-Permissions", "products.update")
                        .content("{\"publishStatus\":\"PUBLISHED\"}"))
                .andExpect(status().isOk());
        assertThat(productJpaRepository.findById(product.getId()).orElseThrow().getHomepageBlock())
                .isEqualTo(HomepageBlock.NONE);
    }

    @Test
    void softDeletingAProductShouldDropItFromTheFeaturedGrid() throws Exception {
        String suffix = String.valueOf(System.currentTimeMillis() + 1);
        String slug = "featured-trash-" + suffix;

        ProductEntity product = createPublishedProduct(slug, suffix);
        pinToFeaturedGrid(product.getId());

        mockMvc.perform(delete("/api/v1/admin/products/{id}", product.getId())
                        .header("X-Admin-Permissions", "products.update"))
                .andExpect(status().isOk());

        ProductEntity trashed = productJpaRepository.findById(product.getId()).orElseThrow();
        assertThat(trashed.getPublishStatus()).isEqualTo(PublishStatus.TRASH);
        assertThat(trashed.getHomepageBlock()).isEqualTo(HomepageBlock.NONE);
        assertThat(trashed.getHomepageOrder()).isNull();
    }

    @Test
    void brandBannerShouldRejectUrlOutsideTheMediaLibrary() throws Exception {
        String suffix = String.valueOf(System.currentTimeMillis());

        mockMvc.perform(post("/api/v1/admin/brands")
                        .contentType(MediaType.APPLICATION_JSON)
                        .characterEncoding(StandardCharsets.UTF_8)
                        .header("X-Admin-Permissions", "catalog.update")
                        .content("""
                                {
                                  "slug":"brand-banner-external-%s",
                                  "name":"Thương hiệu banner ngoài %s",
                                  "banner":{"url":"https://cdn.ben-thu-ba.com/banner.jpg"}
                                }
                                """.formatted(suffix, suffix)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.details[0].field").value("banner.url"))
                .andExpect(jsonPath("$.error.details[0].code").value("INVALID_VALUE"));

        mockMvc.perform(post("/api/v1/admin/brands")
                        .contentType(MediaType.APPLICATION_JSON)
                        .characterEncoding(StandardCharsets.UTF_8)
                        .header("X-Admin-Permissions", "catalog.update")
                        .content("""
                                {
                                  "slug":"brand-mobile-banner-external-%s",
                                  "name":"Thương hiệu banner mobile ngoài %s",
                                  "mobileBanner":{"url":"https://cdn.ben-thu-ba.com/banner-mobile.jpg"}
                                }
                                """.formatted(suffix, suffix)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.details[0].field").value("mobileBanner.url"));
    }

    @Test
    void brandShouldKeepImageAltTextAndAllowClearingDescription() throws Exception {
        String suffix = String.valueOf(System.currentTimeMillis());
        String slug = "brand-alt-desc-" + suffix;

        mockMvc.perform(post("/api/v1/admin/brands")
                        .contentType(MediaType.APPLICATION_JSON)
                        .characterEncoding(StandardCharsets.UTF_8)
                        .header("X-Admin-Permissions", "catalog.update")
                        .content("""
                                {
                                  "slug":"%s",
                                  "name":"Thương hiệu ảnh %s",
                                  "description":"<p>Mô tả ban đầu</p>",
                                  "logo":{"url":"/media/brands/logo.png","alt":"Logo thương hiệu"},
                                  "banner":{"url":"/media/brands/banner.jpg","alt":"Ảnh bìa thương hiệu"}
                                }
                                """.formatted(slug, suffix)))
                .andExpect(status().isOk());

        BrandEntity created = brandJpaRepository.findBySlug(slug).orElseThrow();
        assertThat(created.getLogoAlt()).isEqualTo("Logo thương hiệu");
        assertThat(created.getBannerAlt()).isEqualTo("Ảnh bìa thương hiệu");
        assertThat(created.getDescription()).isEqualTo("<p>Mô tả ban đầu</p>");

        // Chuỗi rỗng = xóa (presence-flag): admin phải xoá được mô tả cũ, và alt gửi kèm
        // ảnh không được biến mất sau lần lưu tiếp theo.
        mockMvc.perform(patch("/api/v1/admin/brands/{id}", created.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .characterEncoding(StandardCharsets.UTF_8)
                        .header("X-Admin-Permissions", "catalog.update")
                        .content("""
                                {
                                  "description":"",
                                  "logo":{"url":"/media/brands/logo.png","alt":"Logo thương hiệu"},
                                  "banner":{"url":"/media/brands/banner.jpg","alt":"Ảnh bìa thương hiệu"}
                                }
                                """))
                .andExpect(status().isOk());

        BrandEntity updated = brandJpaRepository.findById(created.getId()).orElseThrow();
        assertThat(updated.getDescription()).isNull();
        assertThat(updated.getLogoAlt()).isEqualTo("Logo thương hiệu");
        assertThat(updated.getBannerAlt()).isEqualTo("Ảnh bìa thương hiệu");
    }

    @Test
    void brandWithLegacyExternalBannerShouldStayEditable() throws Exception {
        String suffix = String.valueOf(System.currentTimeMillis());
        String slug = "brand-legacy-banner-" + suffix;
        String legacyBanner = "https://legacy.bigbike.vn/wp/banner-cu.jpg";

        mockMvc.perform(post("/api/v1/admin/brands")
                        .contentType(MediaType.APPLICATION_JSON)
                        .characterEncoding(StandardCharsets.UTF_8)
                        .header("X-Admin-Permissions", "catalog.update")
                        .content("""
                                {"slug":"%s","name":"Thương hiệu cũ %s"}
                                """.formatted(slug, suffix)))
                .andExpect(status().isOk());

        BrandEntity brand = brandJpaRepository.findBySlug(slug).orElseThrow();
        brand.setBannerUrl(legacyBanner);
        brandJpaRepository.save(brand);

        // URL cũ giữ nguyên → không bị chặn (grandfathered), chỉ URL MỚI phải nằm trong kho ảnh.
        mockMvc.perform(patch("/api/v1/admin/brands/{id}", brand.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .characterEncoding(StandardCharsets.UTF_8)
                        .header("X-Admin-Permissions", "catalog.update")
                        .content("""
                                {"name":"Thương hiệu cũ đổi tên %s","banner":{"url":"%s"}}
                                """.formatted(suffix, legacyBanner)))
                .andExpect(status().isOk());
    }

    @Test
    void shouldCreateBrandWithoutSeparateEnglishName() throws Exception {
        String suffix = String.valueOf(System.currentTimeMillis());
        String slug = "brand-shared-name-" + suffix;

        mockMvc.perform(post("/api/v1/admin/brands")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Admin-Permissions", "catalog.update")
                        .content("""
                                {"slug":"%s","name":"Shared Brand %s","translations":{"en":{"slug":"Invalid English Slug !!!","name":"Different English Brand","description":"English description"}}}
                                """.formatted(slug, suffix)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("Shared Brand " + suffix));

        BrandEntity brand = brandJpaRepository.findBySlug(slug).orElseThrow();
        assertThat(brand.getName()).isEqualTo("Shared Brand " + suffix);
        assertThat(brand.getSlug()).isEqualTo(slug);
    }

    @Test
    void shouldRejectBrandValidationErrors() throws Exception {
        // missing slug → REQUIRED
        mockMvc.perform(post("/api/v1/admin/brands")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Admin-Permissions", "catalog.update")
                        .content("""
                                {"name":"No Slug Brand"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.details[0].field").value("slug"))
                .andExpect(jsonPath("$.error.details[0].code").value("REQUIRED"));

        // invalid slug format (uppercase + space)
        mockMvc.perform(post("/api/v1/admin/brands")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Admin-Permissions", "catalog.update")
                        .content("""
                                {"slug":"Invalid Slug!!!","name":"Bad Slug Brand"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.details[0].field").value("slug"));

        // missing name → REQUIRED
        mockMvc.perform(post("/api/v1/admin/brands")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Admin-Permissions", "catalog.update")
                        .content("""
                                {"slug":"brand-no-name-test"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.details[0].field").value("name"))
                .andExpect(jsonPath("$.error.details[0].code").value("REQUIRED"));
    }

    @Test
    void shouldRejectBrandDuplicateSlug() throws Exception {
        String suffix = String.valueOf(System.currentTimeMillis());
        String slug = "brand-dup-" + suffix;

        mockMvc.perform(post("/api/v1/admin/brands")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Admin-Permissions", "catalog.update")
                        .content("""
                                {"slug":"%s","name":"Dup Brand First %s"}
                                """.formatted(slug, suffix)))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/admin/brands")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Admin-Permissions", "catalog.update")
                        .content("""
                                {"slug":"%s","name":"Dup Brand Second %s"}
                                """.formatted(slug, suffix)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.details[0].field").value("slug"))
                .andExpect(jsonPath("$.error.details[0].code").value("DUPLICATE"));
    }

    @Test
    void shouldSoftDeleteBrandAndExcludeFromPublicList() throws Exception {
        String suffix = String.valueOf(System.currentTimeMillis());
        String slug = "brand-softdel-" + suffix;

        mockMvc.perform(post("/api/v1/admin/brands")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Admin-Permissions", "catalog.update")
                        .content("""
                                {"slug":"%s","name":"Soft Del Brand %s"}
                                """.formatted(slug, suffix)))
                .andExpect(status().isOk());

        BrandEntity brand = brandJpaRepository.findBySlug(slug)
                .orElseThrow(() -> new IllegalStateException("Expected created brand."));

        // public list sees brand before delete
        mockMvc.perform(get("/api/v1/brands"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[?(@.slug == '%s')]".formatted(slug)).exists());

        // admin DELETE → soft-hides brand
        mockMvc.perform(delete("/api/v1/admin/brands/{id}", brand.getId())
                        .header("X-Admin-Permissions", "catalog.update"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.isVisible").value(false));

        // public list no longer contains this brand
        mockMvc.perform(get("/api/v1/brands"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[?(@.slug == '%s')]".formatted(slug)).doesNotExist());

        // public detail returns 404
        mockMvc.perform(get("/api/v1/brands/{slug}", slug))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("NOT_FOUND"));

        // admin visibility=HIDDEN shows the hidden brand
        mockMvc.perform(get("/api/v1/admin/brands")
                        .param("visibility", "HIDDEN")
                        .param("q", slug)
                        .header("X-Admin-Permissions", "catalog.read"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].isVisible").value(false));
    }

    @Test
    void shouldDeleteBrandIdempotently() throws Exception {
        String suffix = String.valueOf(System.currentTimeMillis());
        String slug = "brand-idempotent-" + suffix;

        mockMvc.perform(post("/api/v1/admin/brands")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Admin-Permissions", "catalog.update")
                        .content("""
                                {"slug":"%s","name":"Idempotent Brand %s"}
                                """.formatted(slug, suffix)))
                .andExpect(status().isOk());

        BrandEntity brand = brandJpaRepository.findBySlug(slug)
                .orElseThrow(() -> new IllegalStateException("Expected created brand."));

        // first DELETE hides the brand
        mockMvc.perform(delete("/api/v1/admin/brands/{id}", brand.getId())
                        .header("X-Admin-Permissions", "catalog.update"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.isVisible").value(false));

        Instant firstUpdatedAt = brandJpaRepository.findById(brand.getId())
                .orElseThrow(() -> new IllegalStateException("Expected brand."))
                .getUpdatedAt();

        // second DELETE → no-op; updatedAt must not change
        mockMvc.perform(delete("/api/v1/admin/brands/{id}", brand.getId())
                        .header("X-Admin-Permissions", "catalog.update"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.isVisible").value(false));

        Instant secondUpdatedAt = brandJpaRepository.findById(brand.getId())
                .orElseThrow(() -> new IllegalStateException("Expected brand."))
                .getUpdatedAt();

        assertThat(secondUpdatedAt).isEqualTo(firstUpdatedAt);
    }

    @Test
    void shouldFilterAdminBrandsByVisibility() throws Exception {
        String suffix = String.valueOf(System.currentTimeMillis());
        String visibleSlug = "brand-filter-vis-" + suffix;
        String hiddenSlug = "brand-filter-hid-" + suffix;

        mockMvc.perform(post("/api/v1/admin/brands")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Admin-Permissions", "catalog.update")
                        .content("""
                                {"slug":"%s","name":"Filter Brand Visible %s"}
                                """.formatted(visibleSlug, suffix)))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/admin/brands")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Admin-Permissions", "catalog.update")
                        .content("""
                                {"slug":"%s","name":"Filter Brand Hidden %s"}
                                """.formatted(hiddenSlug, suffix)))
                .andExpect(status().isOk());

        BrandEntity hiddenBrand = brandJpaRepository.findBySlug(hiddenSlug)
                .orElseThrow(() -> new IllegalStateException("Expected hidden brand."));
        mockMvc.perform(delete("/api/v1/admin/brands/{id}", hiddenBrand.getId())
                        .header("X-Admin-Permissions", "catalog.update"))
                .andExpect(status().isOk());

        // VISIBLE filter → only visible brand in results
        // q=suffix matches both brand names ("Filter Brand Visible {s}" and "Filter Brand Hidden {s}")
        // but visibility=VISIBLE narrows it to 1
        mockMvc.perform(get("/api/v1/admin/brands")
                        .param("visibility", "VISIBLE")
                        .param("q", suffix)
                        .header("X-Admin-Permissions", "catalog.read"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].slug").value(visibleSlug));

        // HIDDEN filter → only hidden brand in results
        mockMvc.perform(get("/api/v1/admin/brands")
                        .param("visibility", "HIDDEN")
                        .param("q", suffix)
                        .header("X-Admin-Permissions", "catalog.read"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].slug").value(hiddenSlug));

        // no filter (default list) → hidden/soft-deleted brand excluded, only visible brand appears
        mockMvc.perform(get("/api/v1/admin/brands")
                        .param("q", suffix)
                        .header("X-Admin-Permissions", "catalog.read"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].slug").value(visibleSlug));
    }

    @Test
    void shouldRestoreAndPermanentlyDeleteTrashedBrandWithProductReassignment() throws Exception {
        String suffix = String.valueOf(System.currentTimeMillis());
        String slug = "brand-permanent-" + suffix;

        mockMvc.perform(post("/api/v1/admin/brands")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Admin-Permissions", "catalog.update")
                        .content("""
                                {"slug":"%s","name":"Permanent Brand %s","showOnHomepage":false}
                                """.formatted(slug, suffix)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.isVisible").value(true))
                .andExpect(jsonPath("$.data.showOnHomepage").value(false));

        BrandEntity brand = brandJpaRepository.findBySlug(slug)
                .orElseThrow(() -> new IllegalStateException("Expected brand."));

        mockMvc.perform(delete("/api/v1/admin/brands/{id}/permanent", brand.getId())
                        .header("X-Admin-Permissions", "catalog.update"))
                .andExpect(status().isConflict());

        mockMvc.perform(delete("/api/v1/admin/brands/{id}", brand.getId())
                        .header("X-Admin-Permissions", "catalog.update"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.isVisible").value(false));

        mockMvc.perform(post("/api/v1/admin/brands/{id}/restore", brand.getId())
                        .header("X-Admin-Permissions", "catalog.update"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.isVisible").value(true));

        mockMvc.perform(delete("/api/v1/admin/brands/{id}", brand.getId())
                        .header("X-Admin-Permissions", "catalog.update"))
                .andExpect(status().isOk());

        ProductEntity product = new ProductEntity();
        product.setId("prod-brand-permanent-" + suffix);
        product.setSlug("product-brand-permanent-" + suffix);
        product.setName("Product Brand Permanent " + suffix);
        product.setBrand(brandJpaRepository.findById(brand.getId()).orElseThrow());
        product.setRetailPrice(BigDecimal.ONE);
        product.setCurrency("VND");
        product.setStockState(ProductStockState.IN_STOCK);
        product.setPublishStatus(PublishStatus.DRAFT);
        product.setCreatedAt(Instant.now());
        product.setUpdatedAt(Instant.now());
        productJpaRepository.saveAndFlush(product);

        mockMvc.perform(delete("/api/v1/admin/brands/{id}/permanent", brand.getId())
                        .header("X-Admin-Permissions", "catalog.update"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.reassignedProductCount").value(1));

        assertThat(brandJpaRepository.findById(brand.getId())).isEmpty();
        assertThat(productJpaRepository.findById(product.getId()).orElseThrow().getBrand().getId())
                .isEqualTo("uncategorized-brand");
    }

    @Test
    void shouldRejectSystemBrandMutation() throws Exception {
        mockMvc.perform(patch("/api/v1/admin/brands/{id}", "uncategorized-brand")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Admin-Permissions", "catalog.update")
                        .content("{\"name\":\"Cannot update\"}"))
                .andExpect(status().isConflict());

        mockMvc.perform(delete("/api/v1/admin/brands/{id}/permanent", "uncategorized-brand")
                        .header("X-Admin-Permissions", "catalog.update"))
                .andExpect(status().isConflict());
    }

    @Test
    void shouldHideBrandSummaryOnPublicWhenBrandIsHidden() throws Exception {
        String suffix = String.valueOf(System.currentTimeMillis());
        String brandSlug = "brand-hidden-product-" + suffix;
        String productSlug = "product-hidden-brand-" + suffix;

        // Create a brand (visible)
        mockMvc.perform(post("/api/v1/admin/brands")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Admin-Permissions", "catalog.update")
                        .content("""
                                {"slug":"%s","name":"Hidden Brand Product %s"}
                                """.formatted(brandSlug, suffix)))
                .andExpect(status().isOk());

        BrandEntity brand = brandJpaRepository.findBySlug(brandSlug)
                .orElseThrow(() -> new IllegalStateException("Expected brand."));

        // Create a draft product assigned to that brand, then publish through the
        // dedicated lifecycle endpoint.
        mockMvc.perform(post("/api/v1/admin/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Admin-Permissions", "products.update")
                        .content("""
                                {
                                  "slug":"%s",
                                  "name":"Product Hidden Brand %s",
                                  "categoryId":"cat_helmet",
                                  "brandId":"%s",
                                  "gender":"Unisex",
                                  "sku":"HIDDEN-BRAND-%s",
                                  "retailPrice":1500000,
                                  "stockState":"IN_STOCK",
                                  "publishStatus":"DRAFT",
                                  "translations":{"en":{"name":"Product Hidden Brand EN %s"}},
                                  "image":{
                                    "url":"%s/wp-uploads/products/%s.jpg",
                                    "alt":"Product Hidden Brand"
                                  }
                                }
                                """.formatted(
                                        productSlug,
                                        suffix,
                                        brand.getId(),
                                        suffix,
                                        suffix,
                                        MEDIA_PUBLIC_BASE_URL,
                                        productSlug
                                )))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.brand.slug").value(brandSlug));

        ProductEntity product = productJpaRepository.findBySlug(productSlug)
                .orElseThrow(() -> new IllegalStateException("Expected product."));
        mockMvc.perform(patch("/api/v1/admin/products/{id}/publish", product.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Admin-Permissions", "products.update")
                        .content("{\"publishStatus\":\"PUBLISHED\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.publishStatus").value("PUBLISHED"));

        // Soft-delete (hide) the brand
        mockMvc.perform(delete("/api/v1/admin/brands/{id}", brand.getId())
                        .header("X-Admin-Permissions", "catalog.update"))
                .andExpect(status().isOk());

        // Public product list: product still appears but brand must be null
        // q matches the name ("Product Hidden Brand {suffix}"), not the slug
        mockMvc.perform(get("/api/v1/products")
                        .param("q", suffix))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].slug").value(productSlug))
                .andExpect(jsonPath("$.data[0].brand").doesNotExist());

        // Public product detail: product accessible but brand must be null
        mockMvc.perform(get("/api/v1/products/{slug}", productSlug))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.slug").value(productSlug))
                .andExpect(jsonPath("$.data.brand").doesNotExist());

        // Admin product detail: brand still visible for management
        mockMvc.perform(get("/api/v1/admin/products/{id}", product.getId())
                        .header("X-Admin-Permissions", "products.read"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.brand.slug").value(brandSlug));
    }

    private static VariantOptionRequest variantOption(String optionName, String optionValue) {
        VariantOptionRequest option = new VariantOptionRequest();
        option.setOptionName(optionName);
        option.setOptionValue(optionValue);
        return option;
    }
}
