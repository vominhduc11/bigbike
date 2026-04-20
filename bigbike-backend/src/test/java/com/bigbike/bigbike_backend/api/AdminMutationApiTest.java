package com.bigbike.bigbike_backend.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bigbike.bigbike_backend.persistence.entity.catalog.BrandEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.CategoryEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.content.ArticleEntity;
import com.bigbike.bigbike_backend.persistence.entity.content.PageEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.BrandJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.CategoryJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.content.ArticleJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.content.PageJpaRepository;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
class AdminMutationApiTest {

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
                    "url": "https://cdn.bigbike.local/products/%s.jpg",
                    "alt": "Phase 4G Product"
                  }
                }
                """.formatted(slug, suffix, slug);

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
}

