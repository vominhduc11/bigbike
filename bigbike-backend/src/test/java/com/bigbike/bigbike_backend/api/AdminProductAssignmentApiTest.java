package com.bigbike.bigbike_backend.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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
class AdminProductAssignmentApiTest {

    private MockMvc mockMvc;

    @Autowired
    private WebApplicationContext webApplicationContext;

    @BeforeEach
    void setup() {
        this.mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build();
    }

    @Test
    void shouldAllowProductReader() throws Exception {
        mockMvc.perform(get("/api/v1/admin/product-assignment")
                        .header("X-Admin-Permissions", "products.read"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.roles").isArray());
    }

    @Test
    void shouldAllowContentReaderWithoutProductPermission() throws Exception {
        mockMvc.perform(get("/api/v1/admin/product-assignment")
                        .header("X-Admin-Permissions", "content.read"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.roles").isArray());
    }

    @Test
    void shouldRejectCallerWithoutEitherReadPermission() throws Exception {
        mockMvc.perform(get("/api/v1/admin/product-assignment")
                        .header("X-Admin-Permissions", "orders.read"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("FORBIDDEN"));
    }
}
