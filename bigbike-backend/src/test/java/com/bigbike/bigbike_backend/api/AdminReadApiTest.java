package com.bigbike.bigbike_backend.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bigbike.bigbike_backend.api.admin.dto.ImageAssetRequest;
import com.bigbike.bigbike_backend.api.admin.dto.SeoMetaRequest;
import com.bigbike.bigbike_backend.api.admin.dto.UpsertProductRequest;
import com.bigbike.bigbike_backend.domain.catalog.Product;
import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import com.bigbike.bigbike_backend.service.admin.AdminCatalogMutationService;
import java.math.BigDecimal;
import java.util.UUID;

@SpringBootTest
@Sql(scripts = "/db/test-seed.sql", executionPhase = Sql.ExecutionPhase.BEFORE_TEST_CLASS)
class AdminReadApiTest {

    private static final UUID DEV_ADMIN_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

    private MockMvc mockMvc;

    @Autowired
    private WebApplicationContext webApplicationContext;

    @Autowired
    private AdminCatalogMutationService adminCatalogMutationService;

    @BeforeEach
    void setup() {
        this.mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build();
    }

    @Test
    void shouldReturnCurrentAdminUserInDevPlaceholderMode() throws Exception {
        mockMvc.perform(get("/api/v1/auth/me"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value("dev-admin-user"))
                .andExpect(jsonPath("$.data.roles[0]").value("ADMIN"))
                .andExpect(jsonPath("$.data.permissions").isArray())
                .andExpect(jsonPath("$.meta.requestId").exists())
                .andExpect(jsonPath("$.meta.timestamp").exists());
    }

    @Test
    void shouldReturnAdminProductListAndDetail() throws Exception {
        mockMvc.perform(get("/api/v1/admin/products")
                        .param("page", "1")
                        .param("size", "8")
                        .param("sort", "updatedAt:desc")
                        .param("q", "ls2")
                        .param("publishStatus", "PUBLISHED")
                        .param("stockState", "IN_STOCK")
                        .header("X-Admin-Permissions", "products.read"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data[0].price.currency").value("VND"))
                .andExpect(jsonPath("$.pagination.page").value(1))
                .andExpect(jsonPath("$.pagination.pageSize").value(8))
                .andExpect(jsonPath("$.meta.requestId").exists());

        mockMvc.perform(get("/api/v1/admin/products/prod_ls2_ff800")
                        .header("X-Admin-Permissions", "products.read"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value("prod_ls2_ff800"))
                .andExpect(jsonPath("$.data.slug").value("mu-bao-hiem-ls2-ff800"));
    }

    @Test
    void shouldReturnProductSeoAndContentBottomInAdminDetail() throws Exception {
        String suffix = String.valueOf(System.currentTimeMillis());
        String slug = "phase3-read-seo-" + suffix;
        String canonicalUrl = "https://bigbike.vn/products/" + slug;
        String ogImageUrl = "http://localhost:9000/bigbike-media/wp-uploads/products/" + slug + "-seo.jpg";

        UpsertProductRequest create = new UpsertProductRequest();
        create.setSlug(slug);
        create.setName("Phase 3 Read SEO Product " + suffix);
        create.setCategoryId("cat_helmet");
        create.setRetailPrice(new BigDecimal("2500000"));
        create.setStockState(ProductStockState.IN_STOCK);
        create.setPublishStatus(PublishStatus.DRAFT);
        create.setContentBottom("<p>Phase 3 read content " + suffix + "</p>");

        SeoMetaRequest seo = new SeoMetaRequest();
        seo.setTitle("Phase 3 read SEO title " + suffix);
        seo.setDescription("Phase 3 read SEO description " + suffix);
        seo.setCanonicalUrl(canonicalUrl);
        seo.setNoIndex(Boolean.TRUE);
        ImageAssetRequest ogImage = new ImageAssetRequest();
        ogImage.setUrl(ogImageUrl);
        ogImage.setAlt("Phase 3 read OG image " + suffix);
        seo.setOgImage(ogImage);
        create.setSeo(seo);

        Product created = adminCatalogMutationService.createProduct(create, DEV_ADMIN_ID);

        mockMvc.perform(get("/api/v1/admin/products/{id}", created.id())
                        .header("X-Admin-Permissions", "products.read"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(created.id()))
                .andExpect(jsonPath("$.data.contentBottom").value("<p>Phase 3 read content " + suffix + "</p>"))
                .andExpect(jsonPath("$.data.seo.title").value("Phase 3 read SEO title " + suffix))
                .andExpect(jsonPath("$.data.seo.description").value("Phase 3 read SEO description " + suffix))
                .andExpect(jsonPath("$.data.seo.canonicalUrl").value(canonicalUrl))
                .andExpect(jsonPath("$.data.seo.ogImage.url").value(ogImageUrl))
                .andExpect(jsonPath("$.data.seo.noIndex").value(true));
    }

    @Test
    void shouldExcludeTrashFromDefaultProductListAndAllowTrashFilter() throws Exception {
        String suffix = String.valueOf(System.currentTimeMillis());
        String slug = "phase2-trash-list-" + suffix;

        UpsertProductRequest create = new UpsertProductRequest();
        create.setSlug(slug);
        create.setName("Trash List Product " + suffix);
        create.setCategoryId("cat_helmet");
        create.setRetailPrice(new BigDecimal("1250000"));
        create.setStockState(ProductStockState.IN_STOCK);
        create.setPublishStatus(PublishStatus.DRAFT);

        Product created = adminCatalogMutationService.createProduct(create, DEV_ADMIN_ID);
        adminCatalogMutationService.softDeleteProduct(created.id(), DEV_ADMIN_ID);

        mockMvc.perform(get("/api/v1/admin/products")
                        .param("q", slug)
                        .header("X-Admin-Permissions", "products.read"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(0));

        mockMvc.perform(get("/api/v1/admin/products")
                        .param("q", slug)
                        .param("publishStatus", "TRASH")
                        .header("X-Admin-Permissions", "products.read"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].id").value(created.id()))
                .andExpect(jsonPath("$.data[0].publishStatus").value("TRASH"));
    }

    @Test
    void shouldReturnCategoryBrandAndContentAdminReadData() throws Exception {
        mockMvc.perform(get("/api/v1/admin/categories")
                        .param("search", "mu")
                        .header("X-Admin-Permissions", "catalog.read"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data[0].id").exists());

        mockMvc.perform(get("/api/v1/admin/brands/brand_ls2")
                        .header("X-Admin-Permissions", "catalog.read"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value("brand_ls2"));

        mockMvc.perform(get("/api/v1/admin/content")
                        .param("type", "ARTICLE")
                        .param("publishStatus", "PUBLISHED")
                        .header("X-Admin-Permissions", "content.read"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data[0].type").exists());

        mockMvc.perform(get("/api/v1/admin/content/article/article_chon_mu_fullface")
                        .header("X-Admin-Permissions", "content.read"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value("article_chon_mu_fullface"))
                .andExpect(jsonPath("$.data.type").value("ARTICLE"));
    }

    @Test
    void shouldReturnForbiddenWhenPermissionMissing() throws Exception {
        mockMvc.perform(get("/api/v1/admin/products")
                        .header("X-Admin-Permissions", "content.read"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("FORBIDDEN"));
    }

    @Test
    void shouldValidateAdminQueryParams() throws Exception {
        mockMvc.perform(get("/api/v1/admin/products")
                        .param("sort", "unknown:desc")
                        .header("X-Admin-Permissions", "products.read"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.details[0].field").value("sort"));

        mockMvc.perform(get("/api/v1/admin/content")
                        .param("type", "INVALID")
                        .header("X-Admin-Permissions", "content.read"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.details[0].field").value("type"));
    }
}
