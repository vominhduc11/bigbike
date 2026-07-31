package com.bigbike.bigbike_backend.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

/**
 * Inventory is a boolean availability model (owner decision 2026-06-23): Còn/Hết is
 * toggled inside the product edit form (products.update).
 *
 * The standalone availability-toggle and CSV-export endpoints this class used to cover
 * were removed 2026-07-15 (AUD-056, owner decision #8 — no internal caller, no external
 * clients). The kept read endpoints are covered by AdminReadApiTest; the Dashboard UI
 * separately covers the summary loading/error states.
 */
@SpringBootTest
@Sql(scripts = "/db/test-seed.sql", executionPhase = Sql.ExecutionPhase.BEFORE_TEST_CLASS)
class Phase1KInventoryP0FixApiTest {

    @Autowired WebApplicationContext webApplicationContext;

    private MockMvc mockMvc;

    @BeforeEach
    void setup() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
                .apply(SecurityMockMvcConfigurers.springSecurity())
                .build();
    }

    // ── filter_gender removed from handler — Spring ignores unknown query params ──

    @Test
    void publicProductList_filterGender_isIgnoredReturns200() throws Exception {
        // filter_gender was removed from CatalogController (no product gender field exists).
        // Spring MVC does not reject unknown query params, so old bookmarked URLs return 200.
        mockMvc.perform(get("/api/v1/products")
                        .param("filter_gender", "male"))
                .andExpect(status().isOk());
    }
}
