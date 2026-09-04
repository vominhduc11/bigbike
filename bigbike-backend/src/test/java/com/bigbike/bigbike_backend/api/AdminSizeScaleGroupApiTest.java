package com.bigbike.bigbike_backend.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.SizeScaleGroupJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.SizeScaleJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.SizeScaleValueJpaRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

/**
 * End-to-end cover for admin-managed size filter groups ({@code CATALOG_RULE_012}).
 */
@SpringBootTest
@Sql(
        scripts = {"/db/test-seed.sql", "/db/size-scale-test-seed.sql"},
        executionPhase = Sql.ExecutionPhase.BEFORE_TEST_CLASS
)
class AdminSizeScaleGroupApiTest {

    private static final String GROUPS = "/api/v1/admin/size-scale-groups";
    private static final String SEEDED_GROUP = "size-group-clothing-letter";

    private MockMvc mockMvc;

    @Autowired
    private WebApplicationContext webApplicationContext;

    @Autowired
    private SizeScaleGroupJpaRepository groupRepository;

    @Autowired
    private ProductJpaRepository productJpaRepository;

    @Autowired
    private SizeScaleJpaRepository scaleRepository;

    @Autowired
    private SizeScaleValueJpaRepository valueRepository;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build();
    }

    @Test
    void listingGroupsRequiresProductsRead() throws Exception {
        mockMvc.perform(get(GROUPS).header("X-Admin-Permissions", "orders.read"))
                .andExpect(status().isForbidden());
    }

    @Test
    void creatingAGroupRequiresProductsUpdate() throws Exception {
        mockMvc.perform(post(GROUPS)
                        .header("X-Admin-Permissions", "products.read")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"label\":\"Cỡ thử\",\"labelEn\":\"Test size\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void createsAGroupWithADerivedKeyThenRenamesItWithoutMovingTheKey() throws Exception {
        String id = createGroup("Cỡ mũ trẻ em", "Kids helmet sizes", "co-mu-tre-em");
        try {
            mockMvc.perform(patch(GROUPS + "/" + id)
                            .header("X-Admin-Permissions", "products.update")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"label\":\"Cỡ mũ nhỏ\"}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.label").value("Cỡ mũ nhỏ"))
                    // The key feeds public filter links, so a rename must never move it.
                    .andExpect(jsonPath("$.data.key").value("co-mu-tre-em"))
                    .andExpect(jsonPath("$.data.labelEn").value("Kids helmet sizes"));
        } finally {
            groupRepository.deleteById(id);
        }
    }

    @Test
    void rejectsASecondGroupThatDerivesTheSameKey() throws Exception {
        String id = createGroup("Cỡ mũ trẻ em", "Kids helmet sizes", "co-mu-tre-em");
        try {
            mockMvc.perform(post(GROUPS)
                            .header("X-Admin-Permissions", "products.update")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"label\":\"Cỡ mũ trẻ em\",\"labelEn\":\"Kids\"}"))
                    .andExpect(status().isConflict());
        } finally {
            groupRepository.deleteById(id);
        }
    }

    @Test
    void deletingAGroupInUseIsBlockedAndNamesTheScaleCount() throws Exception {
        long scalesBefore = scaleRepository.count();
        long valuesBefore = valueRepository.count();

        mockMvc.perform(delete(GROUPS + "/" + SEEDED_GROUP)
                        .header("X-Admin-Permissions", "products.update"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.message").value(
                        org.hamcrest.Matchers.containsString("bảng cỡ")));

        // The group→scales association must never cascade a delete.
        assertThat(scaleRepository.count()).isEqualTo(scalesBefore);
        assertThat(valueRepository.count()).isEqualTo(valuesBefore);
        assertThat(groupRepository.findById(SEEDED_GROUP)).isPresent();
    }

    @Test
    void deletesAGroupNoScaleUses() throws Exception {
        String id = createGroup("Cỡ tạm", "Temp sizes", "co-tam");

        mockMvc.perform(delete(GROUPS + "/" + id)
                        .header("X-Admin-Permissions", "products.update"))
                .andExpect(status().isNoContent());

        assertThat(groupRepository.findById(id)).isEmpty();
    }

    @Test
    void listsDeactivatedGroupsOnlyWhenAskedSoTheyCanBeSwitchedBackOn() throws Exception {
        String id = createGroup("Cỡ ẩn", "Hidden sizes", "co-an");
        try {
            mockMvc.perform(patch(GROUPS + "/" + id)
                            .header("X-Admin-Permissions", "products.update")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"active\":false}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.active").value(false));

            String active = mockMvc.perform(get(GROUPS).header("X-Admin-Permissions", "products.read"))
                    .andExpect(status().isOk())
                    .andReturn().getResponse().getContentAsString();
            assertThat(active).doesNotContain("co-an");

            String all = mockMvc.perform(get(GROUPS)
                            .param("includeInactive", "true")
                            .header("X-Admin-Permissions", "products.read"))
                    .andExpect(status().isOk())
                    .andReturn().getResponse().getContentAsString();
            assertThat(all).contains("co-an");
        } finally {
            groupRepository.deleteById(id);
        }
    }

    @Test
    void switchingAGroupOffKeepsItsScalesAndValuesIntact() throws Exception {
        long scalesBefore = scaleRepository.count();
        long valuesBefore = valueRepository.count();
        try {
            mockMvc.perform(patch(GROUPS + "/" + SEEDED_GROUP)
                            .header("X-Admin-Permissions", "products.update")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"active\":false}"))
                    .andExpect(status().isOk());

            assertThat(scaleRepository.count()).isEqualTo(scalesBefore);
            assertThat(valueRepository.count()).isEqualTo(valuesBefore);
            assertThat(scaleRepository.findByCode("helmet-letter")).isPresent();
        } finally {
            mockMvc.perform(patch(GROUPS + "/" + SEEDED_GROUP)
                    .header("X-Admin-Permissions", "products.update")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"active\":true}"));
        }
    }

    /**
     * The half of the deactivate contract that matters most: hiding a group from the storefront
     * must never make its products unsavable. The admin save-time guard reads the unfiltered
     * catalog on purpose, so this pins that it keeps doing so.
     */
    @Test
    void aProductUsingAScaleInASwitchedOffGroupStillSaves() throws Exception {
        try {
            mockMvc.perform(patch(GROUPS + "/" + SEEDED_GROUP)
                            .header("X-Admin-Permissions", "products.update")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"active\":false}"))
                    .andExpect(status().isOk());

            // The scale must stay editable — otherwise switching a group off would strand every
            // chart inside it and there would be no way back.
            mockMvc.perform(patch("/api/v1/admin/size-scales/size-scale-helmet-letter")
                            .header("X-Admin-Permissions", "products.update")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"name\":\"Cỡ chữ mũ bảo hiểm\",\"groupId\":\""
                                    + SEEDED_GROUP + "\",\"values\":[\"S\",\"M\",\"L\",\"XL\",\"XXL\"]}"))
                    .andExpect(status().isOk());

            // Any product already pinned to that scale keeps its assignment and stays readable.
            for (ProductEntity product : productJpaRepository.findAll()) {
                if ("size-scale-helmet-letter".equals(product.getSizeScaleId())) {
                    mockMvc.perform(get("/api/v1/admin/products/" + product.getId())
                                    .header("X-Admin-Permissions", "products.read"))
                            .andExpect(status().isOk())
                            .andExpect(jsonPath("$.data.sizeScaleId").value("size-scale-helmet-letter"));
                }
            }
        } finally {
            mockMvc.perform(patch(GROUPS + "/" + SEEDED_GROUP)
                    .header("X-Admin-Permissions", "products.update")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"active\":true}"));
        }
    }

    private String createGroup(String label, String labelEn, String expectedKey) throws Exception {
        String body = mockMvc.perform(post(GROUPS)
                        .header("X-Admin-Permissions", "products.update")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                java.util.Map.of("label", label, "labelEn", labelEn))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.key").value(expectedKey))
                .andReturn().getResponse().getContentAsString();
        JsonNode node = objectMapper.readTree(body);
        return node.path("data").path("id").asText();
    }
}
