package com.bigbike.bigbike_backend.api;

import static org.assertj.core.api.Assertions.assertThat;

import com.bigbike.bigbike_backend.api.admin.dto.ImportReportResponse;
import com.bigbike.bigbike_backend.api.admin.dto.ImportRowResult;
import com.bigbike.bigbike_backend.api.admin.dto.ProductImportRow;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.service.admin.ProductImportService;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.web.multipart.MultipartFile;

/**
 * Guards JSON-only product import behavior that is easy to regress when preserving existing rows
 * and matching product/variant identity by SKU.
 */
@SpringBootTest
@Sql(scripts = "/db/test-seed.sql", executionPhase = Sql.ExecutionPhase.BEFORE_TEST_CLASS)
class ProductImportRoundTripTest {

    private static final UUID DEV_ADMIN_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final String MEDIA = "http://localhost:9000/bigbike-media";

    @Autowired
    private ProductImportService productImportService;

    @Autowired
    private ProductJpaRepository productJpaRepository;

    private static MultipartFile jsonFile(String body) {
        return new MockMultipartFile("file", "products.json", "application/json",
                body.getBytes(StandardCharsets.UTF_8));
    }

    /**
     * Regression test for the bug HUONG-DAN.md documents as the intended behavior but the validator
     * previously violated: an update-only file that touches an unrelated field (retailPrice) and
     * omits {@code name}/{@code translations} entirely must not error on the missing EN name, and
     * must not wipe the product's already-saved English name back to blank.
     */
    @Test
    void updateFileOmittingNameAndTranslationsKeepsExistingEnglishName() throws Exception {
        String suffix = String.valueOf(System.currentTimeMillis());
        String sku = "RT2-" + suffix;
        String slug = "roundtrip2-" + suffix;
        String enName = "Round Trip Two EN " + suffix;

        String createArray = """
                [
                  {
                    "sku": "%s",
                    "slug": { "slugVI": "%s" },
                    "name": { "nameVI": "Round Trip Two %s", "nameEN": "%s" },
                    "categoryId": "mu-bao-hiem",
                    "brandId": "ls2",
                    "gender": "Unisex",
                    "retailPrice": 1000000
                  }
                ]
                """.formatted(sku, slug, suffix, enName);
        ImportReportResponse createReport =
                productImportService.commitImport(jsonFile(createArray), Set.of(), DEV_ADMIN_ID);
        assertThat(createReport.errorCount()).isZero();

        String updateArray = """
                [
                  { "sku": "%s", "categoryId": "mu-bao-hiem", "retailPrice": 1200000 }
                ]
                """.formatted(sku);
        ImportReportResponse update =
                productImportService.commitImport(jsonFile(updateArray), Set.of(), DEV_ADMIN_ID);
        assertThat(update.errorCount())
                .as("update-only file omitting name/translations must not error on EN name")
                .isZero();

        var after = productJpaRepository.findBySlug(slug).orElseThrow();
        assertThat(after.getNameEn())
                .as("existing English name is preserved when the update file doesn't touch it")
                .isEqualTo(enName);
        assertThat(after.getRetailPrice())
                .as("the field the file did touch was actually updated")
                .isEqualByComparingTo("1200000");
    }

    /**
     * Matches the exact shape a real shop file used (product-template): legacy singular
     * {@code categoryId}/{@code brandId} set explicitly to the placeholder strings, not omitted.
     * Before the 2026-07-22 fix this was rejected with "Danh mục phải đang hiển thị..." because the
     * literal `uncategorized` category is is_visible=false; the fix must accept it explicitly too,
     * not just when the keys are left out entirely.
     */
    @Test
    void createWithExplicitUncategorizedValuesSucceeds() throws Exception {
        String suffix = String.valueOf(System.currentTimeMillis());
        String sku = "EXPLICIT-UNCAT-" + suffix;
        String slug = "explicit-uncategorized-" + suffix;
        String createArray = """
                [
                  {
                    "sku": "%s",
                    "categoryId": "uncategorized",
                    "brandId": "uncategorized-brand",
                    "gender": "Unisex",
                    "retailPrice": 1680000,
                    "name": { "nameVI": "Tui binh xang %s", "nameEN": "Tank bag %s" },
                    "slug": { "slugVI": "%s" }
                  }
                ]
                """.formatted(sku, suffix, suffix, slug);

        ImportReportResponse create = productImportService.commitImport(jsonFile(createArray), Set.of(), DEV_ADMIN_ID);
        assertThat(create.errorCount())
                .as("explicit categoryId=uncategorized/brandId=uncategorized-brand must import cleanly")
                .isZero();

        ProductImportService.ProductExportFile exported =
                productImportService.exportProductAsTemplateJson(create.rows().get(0).productId());
        ProductImportRow[] exportedRows = new ObjectMapper().readValue(exported.content(), ProductImportRow[].class);
        assertThat(exportedRows).singleElement().satisfies(row -> {
            assertThat(row.getCategorySlugs()).containsExactly("uncategorized");
            assertThat(row.getBrandId()).isEqualTo("uncategorized-brand");
        });
    }

    @Test
    void orderedCategorySlugsAreDeduplicatedAndSurviveExportReimport() throws Exception {
        String suffix = String.valueOf(System.currentTimeMillis());
        String sku = "MULTI-CATEGORY-" + suffix;
        String slug = "multi-category-" + suffix;
        String createArray = """
                [
                  {
                    "sku": "%s",
                    "slug": { "slugVI": "%s" },
                    "name": { "nameVI": "Nhiều danh mục %s", "nameEN": "Multi category %s" },
                    "categorySlugs": ["ao-giap-bao-ho", "mu-bao-hiem", "ao-giap-bao-ho"],
                    "brandId": "ls2",
                    "gender": "Unisex",
                    "retailPrice": 1000000
                  }
                ]
                """.formatted(sku, slug, suffix, suffix);

        ImportReportResponse create = productImportService.commitImport(jsonFile(createArray), Set.of(), DEV_ADMIN_ID);
        assertThat(create.errorCount()).isZero();

        ProductImportService.ProductExportFile exported =
                productImportService.exportProductAsTemplateJson(create.rows().get(0).productId());
        ProductImportRow[] exportedRows = new ObjectMapper().readValue(exported.content(), ProductImportRow[].class);
        assertThat(exportedRows).singleElement().satisfies(row ->
                assertThat(row.getCategorySlugs()).containsExactly("ao-giap-bao-ho", "mu-bao-hiem"));

        ImportReportResponse reimport = productImportService.commitImport(
                new MockMultipartFile("file", "reimport.json", "application/json", exported.content()),
                Set.of(), DEV_ADMIN_ID);
        assertThat(reimport.errorCount()).isZero();
        ProductImportService.ProductExportFile reexported =
                productImportService.exportProductAsTemplateJson(create.rows().get(0).productId());
        ProductImportRow[] reexportedRows = new ObjectMapper().readValue(reexported.content(), ProductImportRow[].class);
        assertThat(reexportedRows).singleElement().satisfies(row ->
                assertThat(row.getCategorySlugs())
                        .containsExactly("ao-giap-bao-ho", "mu-bao-hiem"));
    }

    /**
     * Owner decision 2026-07-22 (product-template/HUONG-DAN.md changelog): a row that CREATES a new
     * product may omit categorySlugs/categoryIds/categoryId and brandId entirely — it must not error,
     * and lands on the locked system placeholders instead (CATEGORY_RULE_005/BRAND_RULE_004).
     */
    @Test
    void createWithoutCategoryOrBrandDefaultsToUnclassified() throws Exception {
        String suffix = String.valueOf(System.currentTimeMillis());
        String sku = "NOCAT-" + suffix;
        String slug = "no-category-brand-" + suffix;
        String createArray = """
                [
                  {
                    "sku": "%s",
                    "slug": { "slugVI": "%s" },
                    "name": { "nameVI": "Không danh mục %s", "nameEN": "No category %s" },
                    "gender": "Unisex",
                    "retailPrice": 500000
                  }
                ]
                """.formatted(sku, slug, suffix, suffix);

        ImportReportResponse create = productImportService.commitImport(jsonFile(createArray), Set.of(), DEV_ADMIN_ID);
        assertThat(create.errorCount())
                .as("category/brand-less create must succeed (defaults to \"Chưa phân loại\")")
                .isZero();

        ProductImportService.ProductExportFile exported =
                productImportService.exportProductAsTemplateJson(create.rows().get(0).productId());
        ProductImportRow[] exportedRows = new ObjectMapper().readValue(exported.content(), ProductImportRow[].class);
        assertThat(exportedRows).singleElement().satisfies(row -> {
            assertThat(row.getCategorySlugs()).containsExactly("uncategorized");
            assertThat(row.getBrandId()).isEqualTo("uncategorized-brand");
        });
    }

    /**
     * Regression test: before the 2026-07-22 fix, {@code resolveCategoryAndBrand} ran before
     * {@code isCreate} was known and unconditionally required category on every row — an UPDATE row
     * that (per HUONG-DAN.md) omits category/brand to mean "don't touch" was wrongly rejected. Reusing
     * the "Chưa phân loại" default only on create (not update) fixed this as a side effect.
     */
    @Test
    void updateOmittingCategoryAndBrandPreservesExisting() throws Exception {
        String suffix = String.valueOf(System.currentTimeMillis());
        String sku = "KEEPCAT-" + suffix;
        String slug = "keep-category-" + suffix;
        String createArray = """
                [
                  {
                    "sku": "%s",
                    "slug": { "slugVI": "%s" },
                    "name": { "nameVI": "Giữ danh mục %s", "nameEN": "Keep category %s" },
                    "categorySlugs": ["mu-bao-hiem"],
                    "brandId": "ls2",
                    "gender": "Unisex",
                    "retailPrice": 700000
                  }
                ]
                """.formatted(sku, slug, suffix, suffix);
        ImportReportResponse create = productImportService.commitImport(jsonFile(createArray), Set.of(), DEV_ADMIN_ID);
        assertThat(create.errorCount()).isZero();

        String updateArray = """
                [
                  { "sku": "%s", "retailPrice": 750000 }
                ]
                """.formatted(sku);
        ImportReportResponse update = productImportService.commitImport(jsonFile(updateArray), Set.of(), DEV_ADMIN_ID);
        assertThat(update.errorCount())
                .as("update-only file omitting category/brand must not error and must not reset to \"Chưa phân loại\"")
                .isZero();

        ProductImportService.ProductExportFile exported =
                productImportService.exportProductAsTemplateJson(create.rows().get(0).productId());
        ProductImportRow[] exportedRows = new ObjectMapper().readValue(exported.content(), ProductImportRow[].class);
        assertThat(exportedRows).singleElement().satisfies(row -> {
            assertThat(row.getCategorySlugs()).containsExactly("mu-bao-hiem");
            assertThat(row.getBrandId()).isEqualTo("ls2");
        });
    }

    /** product-template/HUONG-DAN.md rule 1: {@code sku} is mandatory on every import row. */
    @Test
    void rowWithoutSkuIsRejected() {
        String array = """
                [
                  { "categoryId": "mu-bao-hiem",
                    "name": { "nameVI": "No Sku Product", "nameEN": "No Sku Product EN" },
                    "retailPrice": 500000 }
                ]
                """;
        ImportReportResponse report = productImportService.validateImport(jsonFile(array));
        assertThat(report.errorCount()).isEqualTo(1);
        ImportRowResult row = report.rows().get(0);
        assertThat(row.errors()).anyMatch(e -> "sku".equals(e.field()) && "REQUIRED".equals(e.code()));
    }

    @Test
    void duplicateSkuRowsStillReceiveDistinctSelectionKeys() {
        String array = """
                [
                  { "sku": "DUPLICATE-ROW-KEY", "categoryId": "mu-bao-hiem",
                    "name": { "nameVI": "Dòng thứ nhất", "nameEN": "First row" },
                    "retailPrice": 500000 },
                  { "sku": "DUPLICATE-ROW-KEY", "categoryId": "mu-bao-hiem",
                    "name": { "nameVI": "Dòng thứ hai", "nameEN": "Second row" },
                    "retailPrice": 600000 }
                ]
                """;

        ImportReportResponse report = productImportService.validateImport(jsonFile(array));

        assertThat(report.rows()).hasSize(2);
        assertThat(report.rows()).extracting(ImportRowResult::rowKey)
                .containsExactly("row-1:DUPLICATE-ROW-KEY", "row-2:DUPLICATE-ROW-KEY")
                .doesNotHaveDuplicates();
    }

    @Test
    void importRejectsUnsupportedProductDescriptionBlocks() {
        String suffix = String.valueOf(System.currentTimeMillis());
        String array = """
                [
                  {
                    "sku": "BAD-BLOCK-%s",
                    "categoryId": "mu-bao-hiem",
                    "name": { "nameVI": "Sai block", "nameEN": "Bad block" },
                    "retailPrice": 500000,
                    "descriptionBlocks": [
                      { "type": "heading", "level": 2, "text": "Tiêu đề" },
                      { "type": "video", "provider": "youtube", "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
                      { "type": "feature", "side": "auto", "html": "<p>Không rõ hướng ảnh</p>" }
                    ]
                  }
                ]
                """.formatted(suffix);

        ImportReportResponse report = productImportService.validateImport(jsonFile(array));

        assertThat(report.errorCount()).isEqualTo(1);
        assertThat(report.rows().get(0).errors())
                .anyMatch(e -> "descriptionBlocks[0].type".equals(e.field()) && "INVALID_VALUE".equals(e.code()))
                .anyMatch(e -> "descriptionBlocks[1].type".equals(e.field()) && "INVALID_VALUE".equals(e.code()))
                .anyMatch(e -> "descriptionBlocks[2].side".equals(e.field()) && "INVALID_VALUE".equals(e.code()));
    }

    /**
     * PRODUCT_RULE_009: bulk import always saves as DRAFT. publishStatus from the file is ignored
     * without warning, including legacy values. Publishing is a manual Admin action after import.
     */
    @Test
    void importAlwaysSavesDraftIgnoringFilePublishStatus() {
        String suffix = String.valueOf(System.currentTimeMillis());
        String sku = "RT3-" + suffix;
        String slug = "roundtrip3-" + suffix;

        String createArray = """
                [
                  {
                    "sku": "%s",
                    "slug": { "slugVI": "%s" },
                    "name": { "nameVI": "Round Trip Three %s", "nameEN": "Round Trip Three EN %s" },
                    "categoryId": "mu-bao-hiem",
                    "brandId": "ls2",
                    "gender": "Unisex",
                    "retailPrice": 900000,
                    "image": { "url": "%s/products/%s.jpg", "alt": "Ảnh đăng bán" }
                  }
                ]
                """.formatted(sku, slug, suffix, suffix, MEDIA, slug);
        ImportReportResponse createReport =
                productImportService.commitImport(jsonFile(createArray), Set.of(), DEV_ADMIN_ID);
        assertThat(createReport.errorCount()).isZero();
        String productId = createReport.rows().get(0).productId();

        assertThat(productJpaRepository.findById(productId))
                .hasValueSatisfying(entity -> assertThat(entity.getPublishStatus()).isEqualTo(PublishStatus.DRAFT));

        for (String legacyStatus : new String[] {"PUBLISHED", "HIDDEN", "ARCHIVED", "PENDING", "PRIVATE"}) {
            String updateArray = """
                    [
                      { "sku": "%s", "categoryId": "mu-bao-hiem", "retailPrice": 950000, "publishStatus": "%s" }
                    ]
                    """.formatted(sku, legacyStatus);
            ImportReportResponse update =
                    productImportService.commitImport(jsonFile(updateArray), Set.of(), DEV_ADMIN_ID);

            assertThat(update.errorCount())
                    .as(legacyStatus + " must not error the row")
                    .isZero();
            ImportRowResult row = update.rows().get(0);
            assertThat(row.status()).as(legacyStatus + " row status").isEqualTo("OK");
            assertThat(row.warnings()).as(legacyStatus + " warning list").isEmpty();

            assertThat(productJpaRepository.findBySlug(slug))
                    .as(legacyStatus + " import must leave product as draft")
                    .hasValueSatisfying(entity ->
                            assertThat(entity.getPublishStatus()).isEqualTo(PublishStatus.DRAFT));
        }
    }
}
