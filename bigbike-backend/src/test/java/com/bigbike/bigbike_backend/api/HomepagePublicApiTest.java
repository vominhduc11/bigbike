package com.bigbike.bigbike_backend.api;

import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasItems;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
class HomepagePublicApiTest {

    @Autowired
    private WebApplicationContext webApplicationContext;

    private MockMvc mockMvc;

    @BeforeEach
    void setup() {
        this.mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build();
    }

    // ── Product: filterFeatured ──────────────────────────────────────────────

    @Test
    void listFeaturedProducts_returnsOnlyFeaturedPublishedProducts() throws Exception {
        mockMvc.perform(get("/api/v1/products")
                        .param("featured", "true")
                        .param("size", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$.data[0].isFeatured").value(true))
                .andExpect(jsonPath("$.data[0].rating").exists())
                .andExpect(jsonPath("$.meta.requestId").exists());
    }

    @Test
    void listFeaturedProducts_excludesNonFeatured() throws Exception {
        // prod_kyt_nxrace is HIDDEN and not featured — none of those should appear
        mockMvc.perform(get("/api/v1/products")
                        .param("featured", "true"))
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

    // ── Article: category slug filter ────────────────────────────────────────

    @Test
    void listArticlesByTraiNghiemCategory_returnsThreePublishedReviews() throws Exception {
        mockMvc.perform(get("/api/v1/articles")
                        .param("category", "trai-nghiem")
                        .param("size", "3")
                        .param("sort", "publishedAt:desc"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", hasSize(3)))
                .andExpect(jsonPath("$.data[0].category.slug").value("trai-nghiem"))
                .andExpect(jsonPath("$.meta.requestId").exists());
    }

    @Test
    void listArticlesByBlogCategory_returnsThreePublishedBlogPosts() throws Exception {
        mockMvc.perform(get("/api/v1/articles")
                        .param("category", "blog")
                        .param("size", "3")
                        .param("sort", "publishedAt:desc"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", hasSize(3)))
                .andExpect(jsonPath("$.data[0].category.slug").value("blog"))
                .andExpect(jsonPath("$.meta.requestId").exists());
    }

    // ── PublicSiteSettings: all required homepage keys ───────────────────────

    @Test
    void publicSettings_containsAllRequiredHomepageKeys() throws Exception {
        mockMvc.perform(get("/api/v1/settings/public"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[*].settingKey", hasItems(
                        "zalo_url",
                        "hotline",
                        "promo_title",
                        "promo_off",
                        "promo_href",
                        "promo_image_url",
                        "seo_home_title",
                        "seo_home_description",
                        "og_image_url"
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
