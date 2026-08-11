package com.bigbike.bigbike_backend.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.asyncDispatch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bigbike.bigbike_backend.domain.catalog.HomepageBlock;
import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.persistence.entity.audit.AuditLogEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.BrandEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.CategoryEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.repository.audit.AuditLogJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.BrandJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.CategoryJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.stream.IntStream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
public class AdminProductExportApiTest {

    private static final String REPORTS_EXPORT = "reports.export";

    @Autowired
    private WebApplicationContext webApplicationContext;

    @Autowired
    private ProductJpaRepository productRepository;

    @Autowired
    private CategoryJpaRepository categoryRepository;

    @Autowired
    private BrandJpaRepository brandRepository;

    @Autowired
    private AuditLogJpaRepository auditLogRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        jdbcTemplate.execute("CREATE ALIAS IF NOT EXISTS UNACCENT FOR \"com.bigbike.bigbike_backend.api.AdminProductExportApiTest.unaccent\"");
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build();
    }

    public static String unaccent(String value) {
        if (value == null) return null;
        return Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{InCombiningDiacriticalMarks}+", "")
                .toLowerCase(Locale.ROOT);
    }

    @Test
    void filteredExportAppliesQueryCategoryBrandAndStockAndExcludesDraftAndTrashByDefault() throws Exception {
        Fixture fixture = fixture();

        String csv = complete(get("/api/v1/admin/products/export.csv")
                .param("scope", "FILTERED")
                .param("q", fixture.marker())
                .param("categoryId", fixture.category().getId())
                .param("brandId", fixture.brand().getId())
                .param("stockState", "IN_STOCK")
                .param("preset", "PRICING"));

        assertThat(csv).contains(fixture.included().getSku());
        assertThat(csv).doesNotContain(fixture.draft().getSku(), fixture.trash().getSku());
        assertThat(csv).doesNotContain(fixture.wrongBrand().getSku(), fixture.wrongStock().getSku());
    }

    @Test
    void includeDraftAndTrashExpandsOnlyTheImplicitPublishedDefault() throws Exception {
        Fixture fixture = fixture();

        String csv = complete(get("/api/v1/admin/products/export.csv")
                .param("q", fixture.marker())
                .param("categoryId", fixture.category().getId())
                .param("brandId", fixture.brand().getId())
                .param("stockState", "IN_STOCK")
                .param("includeDraft", "true")
                .param("includeTrash", "true")
                .param("preset", "PRICING"));

        assertThat(csv).contains(
                fixture.included().getSku(), fixture.draft().getSku(), fixture.trash().getSku());
        assertThat(csv).doesNotContain(fixture.wrongBrand().getSku(), fixture.wrongStock().getSku());
    }

    @Test
    void selectedExportUsesOnlyRequestedIdsAndKeepsSkuFirstWithBom() throws Exception {
        Fixture fixture = fixture();

        MvcResult started = mockMvc.perform(get("/api/v1/admin/products/export.csv")
                        .param("scope", "SELECTED")
                        .param("ids", fixture.included().getId() + "," + fixture.draft().getId())
                        .param("includeDraft", "true")
                        .param("preset", "CONTENT_SEO")
                        .header("X-Admin-Permissions", REPORTS_EXPORT))
                .andExpect(request().asyncStarted())
                .andReturn();
        MvcResult completed = mockMvc.perform(asyncDispatch(started))
                .andExpect(status().isOk())
                .andExpect(header().string("X-Export-Streamed", "true"))
                .andReturn();

        byte[] bytes = completed.getResponse().getContentAsByteArray();
        assertThat(bytes).startsWith((byte) 0xEF, (byte) 0xBB, (byte) 0xBF);
        String csv = new String(bytes, 3, bytes.length - 3, StandardCharsets.UTF_8);
        String header = csv.substring(0, csv.indexOf('\n'));
        assertThat(header).startsWith("sku,");
        assertThat(csv).contains("'=1+1");
        assertThat(csv).contains(fixture.included().getSku(), fixture.draft().getSku());
        assertThat(csv).doesNotContain(fixture.trash().getSku(), fixture.wrongBrand().getSku());
    }

    @Test
    void selectedExportRejectsMoreThanTwoHundredIdsAsValidationError() throws Exception {
        String ids = IntStream.range(0, 201)
                .mapToObj(index -> "missing-product-" + index)
                .reduce((left, right) -> left + "," + right)
                .orElseThrow();

        mockMvc.perform(get("/api/v1/admin/products/export.csv")
                        .param("scope", "SELECTED")
                        .param("ids", ids)
                        .header("X-Admin-Permissions", REPORTS_EXPORT))
                .andExpect(status().isBadRequest());
    }

    @Test
    void everyCsvExportAuditsScopeFiltersPresetGroupsAndRowCount() throws Exception {
        Fixture fixture = fixture();
        long before = productExportAuditCount();

        complete(get("/api/v1/admin/products/export.csv")
                .param("q", fixture.marker())
                .param("includeDraft", "true")
                .param("preset", "MEDIA")
                .header("User-Agent", "product-export-test"));

        List<AuditLogEntity> exports = auditLogRepository.findAll().stream()
                .filter(log -> log.getAfterData() != null
                        && log.getAfterData().contains("PRODUCT_CATALOG_CSV"))
                .toList();
        assertThat(exports).hasSizeGreaterThan((int) before);
        String payload = exports.get(exports.size() - 1).getAfterData();
        assertThat(payload).contains("\"scope\":\"FILTERED\"");
        assertThat(payload).contains("\"q\":\"" + fixture.marker() + "\"");
        assertThat(payload).contains("\"includeDraft\":true");
        assertThat(payload).contains("\"preset\":\"MEDIA\"");
        assertThat(payload).contains("\"columnGroups\"");
        assertThat(payload).contains("\"columns\"");
        assertThat(payload).contains("\"rowCount\"");
    }

    @Test
    void exportWithoutReportsPermissionReturnsForbidden() throws Exception {
        mockMvc.perform(get("/api/v1/admin/products/export.csv")
                        .header("X-Admin-Permissions", "products.read"))
                .andExpect(status().isForbidden());
    }

    private String complete(org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder builder)
            throws Exception {
        MvcResult started = mockMvc.perform(builder.header("X-Admin-Permissions", REPORTS_EXPORT))
                .andExpect(request().asyncStarted())
                .andReturn();
        return mockMvc.perform(asyncDispatch(started))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString(StandardCharsets.UTF_8);
    }

    private long productExportAuditCount() {
        return auditLogRepository.findAll().stream()
                .filter(log -> log.getAfterData() != null
                        && log.getAfterData().contains("PRODUCT_CATALOG_CSV"))
                .count();
    }

    private Fixture fixture() {
        String marker = "product-export-" + UUID.randomUUID().toString().replace("-", "");
        CategoryEntity category = new CategoryEntity();
        category.setId(marker + "-category");
        category.setSlug(marker + "-category");
        category.setName("Export category " + marker);
        category.setVisible(true);
        category.setDeleted(false);
        category.setCreatedAt(Instant.now());
        category.setUpdatedAt(category.getCreatedAt());
        category = categoryRepository.saveAndFlush(category);

        BrandEntity brand = new BrandEntity();
        brand.setId(marker + "-brand");
        brand.setSlug(marker + "-brand");
        brand.setName("Export brand " + marker);
        brand.setVisible(true);
        brand.setCreatedAt(Instant.now());
        brand.setUpdatedAt(brand.getCreatedAt());
        brand = brandRepository.saveAndFlush(brand);

        ProductEntity included = product(marker, "included", PublishStatus.PUBLISHED,
                ProductStockState.IN_STOCK, category, brand);
        included.setName("=1+1");
        ProductEntity draft = product(marker, "draft", PublishStatus.DRAFT,
                ProductStockState.IN_STOCK, category, brand);
        ProductEntity trash = product(marker, "trash", PublishStatus.TRASH,
                ProductStockState.IN_STOCK, category, brand);
        ProductEntity wrongBrand = product(marker, "wrong-brand", PublishStatus.PUBLISHED,
                ProductStockState.IN_STOCK, category, null);
        ProductEntity wrongStock = product(marker, "wrong-stock", PublishStatus.PUBLISHED,
                ProductStockState.OUT_OF_STOCK, category, brand);
        productRepository.saveAllAndFlush(List.of(included, draft, trash, wrongBrand, wrongStock));
        return new Fixture(marker, category, brand, included, draft, trash, wrongBrand, wrongStock);
    }

    private ProductEntity product(
            String marker,
            String suffix,
            PublishStatus publishStatus,
            ProductStockState stockState,
            CategoryEntity category,
            BrandEntity brand
    ) {
        ProductEntity product = new ProductEntity();
        product.setId(marker + "-" + suffix);
        product.setSku("SKU-" + marker + "-" + suffix);
        product.setSlug(marker + "-" + suffix);
        product.setName("Product " + marker + " " + suffix);
        product.setBrand(brand);
        product.setCategories(category == null ? List.of() : List.of(category));
        product.setRetailPrice(new BigDecimal("100000"));
        product.setCurrency("VND");
        product.setStockState(stockState);
        product.setStockQuantity(5);
        product.setManageStock(true);
        product.setAvailable(true);
        product.setPublishStatus(publishStatus);
        product.setHomepageBlock(HomepageBlock.NONE);
        product.setCreatedAt(Instant.now());
        product.setUpdatedAt(product.getCreatedAt());
        product.setVariants(List.of());
        product.setGallery(List.of());
        product.setVideos(List.of());
        product.setRelatedProducts(List.of());
        product.setAccessoryProducts(List.of());
        return product;
    }

    private record Fixture(
            String marker,
            CategoryEntity category,
            BrandEntity brand,
            ProductEntity included,
            ProductEntity draft,
            ProductEntity trash,
            ProductEntity wrongBrand,
            ProductEntity wrongStock
    ) {
    }
}
