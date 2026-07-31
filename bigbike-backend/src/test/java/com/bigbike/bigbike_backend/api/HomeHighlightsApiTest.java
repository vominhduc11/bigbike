package com.bigbike.bigbike_backend.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@Sql(scripts = "/db/test-seed.sql", executionPhase = Sql.ExecutionPhase.BEFORE_TEST_CLASS)
class HomeHighlightsApiTest {

    @Autowired
    private WebApplicationContext webApplicationContext;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private MockMvc mockMvc;

    @BeforeEach
    void setup() {
        jdbcTemplate.update("DELETE FROM home_category_highlights");
        jdbcTemplate.update("MERGE INTO home_highlights_config (id, version, updated_at) KEY(id) "
                + "VALUES (1, 0, CURRENT_TIMESTAMP)");
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build();
    }

    @Test
    void adminSaveUsesConfigVersionAndRejectsStaleRequestWithoutOverwriting() throws Exception {
        mockMvc.perform(get("/api/v1/admin/home/category-highlights")
                        .header("X-Admin-Permissions", "home_highlights.read"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items").isArray())
                .andExpect(jsonPath("$.data.version").value(0));

        mockMvc.perform(put("/api/v1/admin/home/category-highlights")
                        .header("X-Admin-Permissions", "home_highlights.write,products.read")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "slots": [{"slot": 1, "productId": "prod_ls2_ff800"}],
                                  "expectedVersion": 0
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.version").value(1))
                .andExpect(jsonPath("$.data.items[0].productId").value("prod_ls2_ff800"));

        mockMvc.perform(put("/api/v1/admin/home/category-highlights")
                        .header("X-Admin-Permissions", "home_highlights.write,products.read")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "slots": [{"slot": 1, "productId": "prod_ls2_jacket_city"}],
                                  "expectedVersion": 0
                                }
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("CONCURRENT_MODIFICATION"));

        mockMvc.perform(get("/api/v1/home/category-highlights"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].productId").value("prod_ls2_ff800"));
    }

    @Test
    void adminSaveRequiresProductsReadInAdditionToWrite() throws Exception {
        mockMvc.perform(put("/api/v1/admin/home/category-highlights")
                        .header("X-Admin-Permissions", "home_highlights.write")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "slots": [{"slot": 1, "productId": "prod_ls2_ff800"}],
                                  "expectedVersion": 0
                                }
                                """))
                .andExpect(status().isForbidden());
    }
}
