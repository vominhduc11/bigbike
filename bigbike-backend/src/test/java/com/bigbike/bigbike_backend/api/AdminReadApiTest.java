package com.bigbike.bigbike_backend.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bigbike.bigbike_backend.api.admin.dto.ImageAssetRequest;
import com.bigbike.bigbike_backend.api.admin.dto.ProductTranslationRequest;
import com.bigbike.bigbike_backend.api.admin.dto.SeoMetaRequest;
import com.bigbike.bigbike_backend.api.admin.dto.UpsertProductRequest;
import com.bigbike.bigbike_backend.domain.catalog.Product;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import com.bigbike.bigbike_backend.service.admin.ProductMutationService;
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
    private ProductMutationService productMutationService;

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
    void shouldKeepInventoryReadBoundaryForListAndDashboardSummary() throws Exception {
        mockMvc.perform(get("/api/v1/admin/inventory")
                        .header("X-Admin-Permissions", "inventory.read"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isArray())
                .andExpect(jsonPath("$.page").value(1));

        mockMvc.perform(get("/api/v1/admin/inventory/summary")
                        .header("X-Admin-Permissions", "inventory.read"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalItems").exists())
                .andExpect(jsonPath("$.inStockCount").exists())
                .andExpect(jsonPath("$.outOfStockCount").exists());

        mockMvc.perform(get("/api/v1/admin/inventory/summary")
                        .header("X-Admin-Permissions", "products.read"))
                .andExpect(status().isForbidden());
    }

    @Test
    void shouldFilterAdminProductsByGenderCaseInsensitively() throws Exception {
        String suffix = String.valueOf(System.currentTimeMillis());

        UpsertProductRequest men = new UpsertProductRequest();
        men.setSlug("gender-men-" + suffix);
        men.setName("Gender Men Product " + suffix);
        men.setCategoryId("cat_helmet");
        men.setBrandId("brand_ls2");
        men.setGender("Nam");
        men.setSku("GENDER-MEN-" + suffix);
        men.setRetailPrice(new BigDecimal("1500000"));
        men.setPublishStatus(PublishStatus.DRAFT);
        men.setTranslations(new ProductTranslationRequest(
                ProductTranslationRequest.ProductContentRequest.builder()
                        .name("Gender Men Product EN " + suffix)
                        .build()));

        UpsertProductRequest women = new UpsertProductRequest();
        women.setSlug("gender-women-" + suffix);
        women.setName("Gender Women Product " + suffix);
        women.setCategoryId("cat_helmet");
        women.setBrandId("brand_ls2");
        women.setGender("Nữ");
        women.setSku("GENDER-WOMEN-" + suffix);
        women.setRetailPrice(new BigDecimal("1500000"));
        women.setPublishStatus(PublishStatus.DRAFT);
        women.setTranslations(new ProductTranslationRequest(
                ProductTranslationRequest.ProductContentRequest.builder()
                        .name("Gender Women Product EN " + suffix)
                        .build()));

        productMutationService.createProduct(men, DEV_ADMIN_ID);
        productMutationService.createProduct(women, DEV_ADMIN_ID);
        UpsertProductRequest noGender = new UpsertProductRequest();
        noGender.setSlug("gender-none-" + suffix);
        noGender.setName("Gender None Product " + suffix);
        noGender.setCategoryId("cat_helmet");
        noGender.setBrandId("brand_ls2");
        noGender.setSku("GENDER-NONE-" + suffix);
        noGender.setRetailPrice(new BigDecimal("1500000"));
        noGender.setPublishStatus(PublishStatus.DRAFT);
        noGender.setTranslations(new ProductTranslationRequest(
                ProductTranslationRequest.ProductContentRequest.builder()
                        .name("Gender None Product EN " + suffix)
                        .build()));
        productMutationService.createProduct(noGender, DEV_ADMIN_ID);

        mockMvc.perform(get("/api/v1/admin/products")
                        .param("filter_gender", "nam")
                        .param("size", "100")
                        .header("X-Admin-Permissions", "products.read"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[*].gender", everyItem(is("Nam"))))
                .andExpect(jsonPath("$.data[*].slug", hasItem(men.getSlug())));

        mockMvc.perform(get("/api/v1/admin/products")
                        .param("filter_gender", "Nữ")
                        .param("size", "100")
                        .header("X-Admin-Permissions", "products.read"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[*].gender", everyItem(is("Nữ"))))
                .andExpect(jsonPath("$.data[*].slug", hasItem(women.getSlug())));

        mockMvc.perform(get("/api/v1/admin/products")
                        .param("filter_gender", "NULL")
                        .param("size", "100")
                        .header("X-Admin-Permissions", "products.read"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[*].gender", everyItem(nullValue())))
                .andExpect(jsonPath("$.data[*].slug", hasItem(noGender.getSlug())));
    }

    @Test
    void shouldReturnProductSeoWithoutRemovedContentBottomInAdminDetail() throws Exception {
        String suffix = String.valueOf(System.currentTimeMillis());
        String slug = "phase3-read-seo-" + suffix;
        String canonicalUrl = "https://bigbike.vn/products/" + slug;
        String ogImageUrl = "http://localhost:9000/bigbike-media/wp-uploads/products/" + slug + "-seo.jpg";

        UpsertProductRequest create = new UpsertProductRequest();
        create.setSlug(slug);
        create.setName("Phase 3 Read SEO Product " + suffix);
        create.setCategoryId("cat_helmet");
        create.setBrandId("brand_ls2");
        create.setGender("Nam");
        create.setSku("SKU-" + suffix);
        create.setRetailPrice(new BigDecimal("2500000"));
        create.setPublishStatus(PublishStatus.DRAFT);
        create.setTranslations(new ProductTranslationRequest(
                ProductTranslationRequest.ProductContentRequest.builder()
                        .name("Phase 3 Read SEO Product EN " + suffix)
                        .build()));
        SeoMetaRequest seo = new SeoMetaRequest();
        seo.setTitle("Phase 3 read SEO title " + suffix);
        seo.setDescription("Phase 3 read SEO description " + suffix);
        seo.setCanonicalUrl(canonicalUrl);
        // V371: cờ noIndex của sản phẩm được LƯU THẬT (trước đó bị nhận rồi vứt im lặng, và
        // assertion `noIndex == true` bên dưới không thể đúng). BUSINESS_RULES `SEO_RULE_001`.
        seo.setNoIndex(true);
        ImageAssetRequest ogImage = new ImageAssetRequest();
        ogImage.setUrl(ogImageUrl);
        ogImage.setAlt("Phase 3 read OG image " + suffix);
        seo.setOgImage(ogImage);
        create.setSeo(seo);

        Product created = productMutationService.createProduct(create, DEV_ADMIN_ID);

        mockMvc.perform(get("/api/v1/admin/products/{id}", created.id())
                        .header("X-Admin-Permissions", "products.read"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(created.id()))
                .andExpect(jsonPath("$.data.contentBottom").doesNotExist())
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
        create.setBrandId("brand_ls2");
        create.setGender("Nam");
        create.setSku("SKU-" + suffix);
        create.setRetailPrice(new BigDecimal("1250000"));
        create.setPublishStatus(PublishStatus.DRAFT);
        create.setTranslations(new ProductTranslationRequest(
                ProductTranslationRequest.ProductContentRequest.builder()
                        .name("Trash List Product EN " + suffix)
                        .build()));

        Product created = productMutationService.createProduct(create, DEV_ADMIN_ID);
        productMutationService.softDeleteProduct(created.id(), DEV_ADMIN_ID);

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
    void softDeletingAPublishedProductSequencesThroughDraftToTrashInvisibly() throws Exception {
        String suffix = String.valueOf(System.currentTimeMillis());
        String slug = "phase2-publish-then-trash-" + suffix;

        UpsertProductRequest create = new UpsertProductRequest();
        create.setSlug(slug);
        create.setName("Publish Then Trash Product " + suffix);
        create.setCategoryId("cat_helmet");
        create.setBrandId("brand_ls2");
        create.setGender("Nam");
        create.setSku("SKU-" + suffix);
        create.setRetailPrice(new BigDecimal("1250000"));
        create.setPublishStatus(PublishStatus.DRAFT);
        ImageAssetRequest image = new ImageAssetRequest();
        image.setUrl("http://localhost:9000/bigbike-media/wp-uploads/" + slug + ".jpg");
        image.setAlt("Publish Then Trash Product " + suffix);
        create.setImage(image);
        create.setTranslations(new ProductTranslationRequest(
                ProductTranslationRequest.ProductContentRequest.builder()
                        .name("Publish Then Trash Product EN " + suffix)
                        .build()));

        Product created = productMutationService.createProduct(create, DEV_ADMIN_ID);
        productMutationService.updateProductPublishStatus(created.id(), PublishStatus.PUBLISHED, DEV_ADMIN_ID);
        Product deleted = productMutationService.softDeleteProduct(created.id(), DEV_ADMIN_ID);

        // Ends up in TRASH in one call — the intermediate DRAFT hop never surfaces as a
        // separately observable state (owner decision 2026-07-07).
        assertThat(deleted.publishStatus()).isEqualTo(PublishStatus.TRASH);

        mockMvc.perform(get("/api/v1/admin/products/{id}", created.id())
                        .header("X-Admin-Permissions", "products.read"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.publishStatus").value("TRASH"));
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
