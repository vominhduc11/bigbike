package com.bigbike.bigbike_backend.api;

import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.hamcrest.Matchers.hasItems;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bigbike.bigbike_backend.persistence.entity.catalog.CategoryEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.CategoryJpaRepository;
import java.time.Instant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@Sql(scripts = "/db/test-seed.sql", executionPhase = Sql.ExecutionPhase.BEFORE_TEST_CLASS)
class HomepagePublicApiTest {

    @Autowired
    private WebApplicationContext webApplicationContext;

    @Autowired
    private CategoryJpaRepository categoryRepository;

    private MockMvc mockMvc;

    @BeforeEach
    void setup() {
        this.mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build();
        resetHomepageCategory("cat_helmet", "mu-bao-hiem", "Mu bao hiem", 2);
        resetHomepageCategory("cat_jacket", "ao-giap-bao-ho", "Ao giap bao ho", 1);
    }

    private void resetHomepageCategory(String id, String slug, String name, int sortOrder) {
        CategoryEntity category = categoryRepository.findById(id).orElseGet(CategoryEntity::new);
        category.setId(id);
        category.setSlug(slug);
        category.setName(name);
        category.setVisible(true);
        category.setDeleted(false);
        category.setShowOnHomepage(true);
        category.setSortOrder(sortOrder);
        if (category.getCreatedAt() == null) {
            category.setCreatedAt(Instant.now());
        }
        category.setUpdatedAt(Instant.now());
        categoryRepository.save(category);
    }

    // ── Product: homepage_block=FEATURED_GRID ────────────────────────────────

    @Test
    void listFeaturedProducts_returnsOnlyFeaturedPublishedProducts() throws Exception {
        mockMvc.perform(get("/api/v1/products")
                        .param("homepage_block", "FEATURED_GRID")
                        .param("size", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$.data[0].homepageBlock").value("FEATURED_GRID"))
                .andExpect(jsonPath("$.data[0].rating").exists())
                .andExpect(jsonPath("$.meta.requestId").exists());
    }

    @Test
    void listFeaturedProducts_excludesNonFeatured() throws Exception {
        // prod_kyt_nxrace is DRAFT (not PUBLISHED) and not in FEATURED_GRID — should not appear
        mockMvc.perform(get("/api/v1/products")
                        .param("homepage_block", "FEATURED_GRID"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[?(@.slug == 'mu-bao-hiem-kyt-nx-race')]").doesNotExist());
    }

    // ── Category: filterHome + sortOrder:desc ────────────────────────────────

    @Test
    void listHomepageCategories_returnsShowOnHomepageTrueInDescSortOrder() throws Exception {
        mockMvc.perform(get("/api/v1/categories")
                        .param("filterHome", "true")
                        .param("sort", "sortOrder:desc")
                        .param("size", "8"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", hasSize(greaterThanOrEqualTo(2))))
                .andExpect(jsonPath("$.data[0].showOnHomepage").value(true))
                // dev seed: cat_helmet sortOrder=2, cat_jacket sortOrder=1 → descending: helmet first
                .andExpect(jsonPath("$.data[0].slug").value("mu-bao-hiem"))
                .andExpect(jsonPath("$.data[1].slug").value("ao-giap-bao-ho"))
                .andExpect(jsonPath("$.meta.requestId").exists());
    }

    @Test
    void listHomepageCategories_excludesCategoriesNotFlaggedForHomepage() throws Exception {
        // When filterHome=false (no filter), both show; with filterHome=true only show_on_homepage=true
        mockMvc.perform(get("/api/v1/categories").param("filterHome", "true"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[?(@.showOnHomepage != true)]").doesNotExist());
    }

    // ── Brand: homepage-only placement filter ───────────────────────────────

    @Test
    void listHomepageBrands_filtersOnlyHomepageFlagAndKeepsPublicBrandListUnfiltered() throws Exception {
        mockMvc.perform(get("/api/v1/brands").param("size", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[?(@.slug == 'kyt')].showOnHomepage").value(hasItems(false)))
                .andExpect(jsonPath("$.data[?(@.slug == 'kyt')]").exists());

        mockMvc.perform(get("/api/v1/brands")
                        .param("showOnHomepage", "true")
                        .param("size", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[?(@.slug == 'kyt')]").doesNotExist())
                .andExpect(jsonPath("$.data[?(@.showOnHomepage != true)]").doesNotExist());
    }

    // ── Article: content categories were removed ─────────────────────────────

    @Test
    void listArticles_doesNotExposeRemovedContentCategory() throws Exception {
        mockMvc.perform(get("/api/v1/articles")
                        .param("size", "3")
                        .param("sort", "publishedAt:desc"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", hasSize(3)))
                .andExpect(jsonPath("$.data[0].category").doesNotExist())
                .andExpect(jsonPath("$.meta.requestId").exists());
    }

    // ── PublicSiteSettings: all required homepage keys ───────────────────────

    @Test
    void publicSettings_containsAllRequiredHomepageKeys() throws Exception {
        mockMvc.perform(get("/api/v1/settings/public"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[*].settingKey", hasItems(
                        "zalo_url",
                        "hotline"
                )))
                .andExpect(jsonPath("$.meta.requestId").exists());
    }

    @Test
    void publicSettings_hotlineHasValue() throws Exception {
        mockMvc.perform(get("/api/v1/settings/public"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[?(@.settingKey == 'hotline')].settingValue").isNotEmpty());
    }

    // ── Product rating field ─────────────────────────────────────────────────

    @Test
    void productDetail_includesRatingField() throws Exception {
        mockMvc.perform(get("/api/v1/products/mu-bao-hiem-ls2-ff800"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.rating").value(4.5));
    }

    @Test
    void productDetail_ratingNullableForProductWithoutRating() throws Exception {
        // prod_ls2_jacket_city has rating=4.8 in dev seed
        mockMvc.perform(get("/api/v1/products/ao-giap-ls2-city-rider"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.rating").value(4.8));
    }
}
