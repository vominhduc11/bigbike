package com.bigbike.bigbike_backend.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import static org.assertj.core.api.Assertions.assertThat;

import com.bigbike.bigbike_backend.api.admin.dto.UpsertProductRequest;
import com.bigbike.bigbike_backend.api.admin.dto.VariantOptionRequest;
import com.bigbike.bigbike_backend.api.admin.dto.VariantRequest;
import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.BrandEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.CategoryEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.content.ArticleEntity;
import com.bigbike.bigbike_backend.persistence.entity.content.PageEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductVariantJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.BrandJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.CategoryJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.content.ArticleJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.content.PageJpaRepository;
import com.bigbike.bigbike_backend.service.admin.AdminCatalogMutationService;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.List;
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
    private PageJpaRepository pageJpaRepository;

    @Autowired
    private AdminCatalogMutationService adminCatalogMutationService;

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
                  "retailPrice": 2500000,
                  "compareAtPrice": 2900000,
                  "salePrice": 2300000,
                  "currency": "VND",
                  "stockState": "IN_STOCK",
                  "publishStatus": "DRAFT",
                  "image": {
                    "url": "%s/wp-uploads/products/%s.jpg",
                    "alt": "Phase 4G Product"
                  }
                }
                """.formatted(slug, suffix, MEDIA_PUBLIC_BASE_URL, slug);

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
                  "salePrice": 2200000
                }
                """.formatted(suffix);

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
    void shouldValidateProductMutationRules() throws Exception {
        String invalidSalePayload = """
                {
                  "slug": "phase4g-invalid-sale-%d",
                  "name": "Invalid Sale Product",
                  "categoryId": "cat_helmet",
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
    void shouldPersistProductSeoAndContentBottomAndAllowExplicitNullClear() throws Exception {
        String suffix = String.valueOf(System.currentTimeMillis());
        String slug = "phase3-seo-content-" + suffix;
        String canonicalUrl = "https://bigbike.vn/products/" + slug;
        String imageUrl = MEDIA_PUBLIC_BASE_URL + "/wp-uploads/products/" + slug + "-seo.jpg";

        String createPayload = """
                {
                  "slug": "%s",
                  "name": "Phase 3 SEO Content Product %s",
                  "categoryId": "cat_helmet",
                  "retailPrice": 2500000,
                  "stockState": "IN_STOCK",
                  "publishStatus": "DRAFT",
                  "contentBottom": "<p>Phase 3 SEO content %s</p>",
                  "seo": {
                    "title": "Phase 3 SEO title %s",
                    "description": "Phase 3 SEO description %s",
                    "canonicalUrl": "%s",
                    "ogImage": {
                      "url": "%s",
                      "alt": "Phase 3 SEO OG image %s"
                    },
                    "noIndex": true
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
                .andExpect(jsonPath("$.data.contentBottom").value("<p>Phase 3 SEO content " + suffix + "</p>"))
                .andExpect(jsonPath("$.data.seo.title").value("Phase 3 SEO title " + suffix))
                .andExpect(jsonPath("$.data.seo.noIndex").value(true));

        ProductEntity created = productJpaRepository.findBySlug(slug)
                .orElseThrow(() -> new IllegalStateException("Expected created product."));

        assertThat(created.getContentBottom()).isEqualTo("<p>Phase 3 SEO content " + suffix + "</p>");
        assertThat(created.getSeoTitle()).isEqualTo("Phase 3 SEO title " + suffix);
        assertThat(created.getSeoDescription()).isEqualTo("Phase 3 SEO description " + suffix);
        assertThat(created.getSeoCanonicalUrl()).isEqualTo(canonicalUrl);
        assertThat(created.getSeoOgImageUrl()).isEqualTo(imageUrl);
        assertThat(created.getSeoOgImageAlt()).isEqualTo("Phase 3 SEO OG image " + suffix);
        assertThat(created.getSeoNoIndex()).isTrue();

        String updatePayload = """
                {
                  "name": "Phase 3 SEO Content Product Updated %s",
                  "contentBottom": "<p>Phase 3 SEO content updated %s</p>",
                  "seo": {
                    "title": "Phase 3 SEO title updated %s",
                    "description": "Phase 3 SEO description updated %s",
                    "canonicalUrl": "https://bigbike.vn/products/%s-updated",
                    "ogImage": {
                      "url": "%s/wp-uploads/products/%s-seo-updated.jpg",
                      "alt": "Phase 3 SEO OG image updated %s"
                    },
                    "noIndex": false
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
                .andExpect(jsonPath("$.data.contentBottom").value("<p>Phase 3 SEO content updated " + suffix + "</p>"))
                .andExpect(jsonPath("$.data.seo.title").value("Phase 3 SEO title updated " + suffix))
                .andExpect(jsonPath("$.data.seo.noIndex").value(false));

        ProductEntity updated = productJpaRepository.findById(created.getId())
                .orElseThrow(() -> new IllegalStateException("Expected updated product."));
        assertThat(updated.getContentBottom()).isEqualTo("<p>Phase 3 SEO content updated " + suffix + "</p>");
        assertThat(updated.getSeoTitle()).isEqualTo("Phase 3 SEO title updated " + suffix);
        assertThat(updated.getSeoDescription()).isEqualTo("Phase 3 SEO description updated " + suffix);
        assertThat(updated.getSeoCanonicalUrl()).isEqualTo("https://bigbike.vn/products/" + slug + "-updated");
        assertThat(updated.getSeoOgImageUrl()).isEqualTo(MEDIA_PUBLIC_BASE_URL + "/wp-uploads/products/" + slug + "-seo-updated.jpg");
        assertThat(updated.getSeoOgImageAlt()).isEqualTo("Phase 3 SEO OG image updated " + suffix);
        assertThat(updated.getSeoNoIndex()).isFalse();

        mockMvc.perform(patch("/api/v1/admin/products/{id}", created.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .characterEncoding(StandardCharsets.UTF_8)
                        .header("X-Admin-Permissions", "products.update")
                        .content("""
                                {
                                  "contentBottom": null
                                }
                                """))
                .andExpect(status().isOk());

        ProductEntity cleared = productJpaRepository.findById(created.getId())
                .orElseThrow(() -> new IllegalStateException("Expected cleared product."));
        assertThat(cleared.getContentBottom()).isNull();
        assertThat(cleared.getSeoTitle()).isEqualTo("Phase 3 SEO title updated " + suffix);
    }

    @Test
    void updateProductShouldNotWipeVariantPricesWhenVariantPriceFieldsAreAbsent() throws Exception {
        String suffix = String.valueOf(System.currentTimeMillis());

        UpsertProductRequest create = new UpsertProductRequest();
        create.setSlug("phase1-variant-price-" + suffix);
        create.setName("Phase 1 Variant Price Product " + suffix);
        create.setCategoryId("cat_helmet");
        create.setRetailPrice(new BigDecimal("2500000"));
        create.setCompareAtPrice(new BigDecimal("2900000"));
        create.setSalePrice(new BigDecimal("2300000"));
        create.setCurrency("VND");
        create.setStockState(ProductStockState.IN_STOCK);
        create.setPublishStatus(PublishStatus.DRAFT);

        VariantRequest variant = new VariantRequest();
        variant.setSku("VAR-" + suffix);
        variant.setName("Black / M");
        variant.setRetailPrice(new BigDecimal("1800000"));
        variant.setCompareAtPrice(new BigDecimal("2100000"));
        variant.setSalePrice(new BigDecimal("1700000"));
        variant.setStockState(ProductStockState.IN_STOCK);
        variant.setIsAvailable(true);
        variant.setSortOrder(0);
        variant.setOptions(List.of(variantOption("Size", "M")));
        variant.setGallery(List.of());
        create.setVariants(List.of(variant));

        var saved = adminCatalogMutationService.createProduct(create);
        String productId = saved.id();
        String variantId = saved.variants().get(0).id();

        String updatePayload = """
                {
                  "name": "Phase 1 Variant Price Product Updated %s",
                  "categoryId": "cat_helmet",
                  "retailPrice": 2500000,
                  "compareAtPrice": 2900000,
                  "salePrice": 2300000,
                  "currency": "VND",
                  "stockState": "IN_STOCK",
                  "publishStatus": "DRAFT",
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
                """.formatted(suffix, variantId, suffix);

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
        assertThat(updatedVariant.getCompareAtPrice()).isEqualByComparingTo("2100000");
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
                    "retailPrice": 1250000,
                    "stockState": "IN_STOCK",
                    "publishStatus": "DRAFT",
                    "image": {
                      "url": "%s/wp-uploads/products/%s.jpg",
                      "alt": "Phase 2 Trash Product"
                    }
                  }
                  """.formatted(slug, suffix, MEDIA_PUBLIC_BASE_URL, slug);

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
                    "retailPrice": 1250000,
                    "stockState": "IN_STOCK",
                    "publishStatus": "DRAFT",
                    "image": {
                      "url": "%s/wp-uploads/products/%s.jpg",
                      "alt": "Phase 2 Restore Permission Product"
                    }
                  }
                  """.formatted(slug, suffix, MEDIA_PUBLIC_BASE_URL, slug);

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
                                  "visible": true
                                }
                                """.formatted(categorySlug, suffix)))
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
                                  "visible": false
                                }
                                """.formatted(suffix)))
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
                                  "visible": true
                                }
                                """.formatted(brandSlug, suffix)))
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
                                  "visible": false
                                }
                                """.formatted(suffix)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.isVisible").value(false));

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
                                  "publishStatus": "DRAFT"
                                }
                                """.formatted(articleSlug, suffix)))
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
                                  "publishStatus": "PUBLISHED"
                                }
                                """.formatted(suffix)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.publishStatus").value("PUBLISHED"));

        String pageSlug = "phase4g-page-" + suffix;
        mockMvc.perform(post("/api/v1/admin/content/pages")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Admin-Permissions", "content.update")
                        .content("""
                                {
                                  "slug": "%s",
                                  "title": "Phase 4G Page %s",
                                  "body": "<p>Page body</p>",
                                  "pageType": "CUSTOM",
                                  "publishStatus": "DRAFT"
                                }
                                """.formatted(pageSlug, suffix)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.type").value("PAGE"))
                .andExpect(jsonPath("$.data.slug").value(pageSlug));

        PageEntity page = pageJpaRepository.findBySlug(pageSlug)
                .orElseThrow(() -> new IllegalStateException("Expected created page."));

        mockMvc.perform(patch("/api/v1/admin/content/pages/{id}", page.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Admin-Permissions", "content.update")
                        .content("""
                                {
                                  "title": "Phase 4G Page Updated %s",
                                  "publishStatus": "PUBLISHED"
                                }
                                """.formatted(suffix)))
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

    private static VariantOptionRequest variantOption(String optionName, String optionValue) {
        VariantOptionRequest option = new VariantOptionRequest();
        option.setOptionName(optionName);
        option.setOptionValue(optionValue);
        return option;
    }
}
