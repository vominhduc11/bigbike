package com.bigbike.bigbike_backend.api;

import static org.assertj.core.api.Assertions.assertThat;

import com.bigbike.bigbike_backend.api.admin.dto.ImportReportResponse;
import com.bigbike.bigbike_backend.api.admin.dto.ImportRowResult;
import com.bigbike.bigbike_backend.api.admin.dto.ProductImportRow;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
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
 * and matching product identity by SKU — including the 2026-08-08 rule that import never writes
 * variants (see also {@link ProductImportMediaPreservationTest} for the update side).
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

    @Test
    void canonicalBothGenderValuesSurviveImportExportAndReimport() throws Exception {
        String suffix = String.valueOf(System.currentTimeMillis());
        String sku = "BOTH-GENDER-" + suffix;
        String slug = "both-gender-" + suffix;
        String createArray = """
                [
                  {
                    "sku": "%s",
                    "slug": { "slugVI": "%s" },
                    "name": { "nameVI": "Sản phẩm hai giới %s", "nameEN": "All gender product %s" },
                    "categoryId": "mu-bao-hiem",
                    "brandId": "ls2",
                    "genders": ["Nam", "Nữ"],
                    "retailPrice": 1000000
                  }
                ]
                """.formatted(sku, slug, suffix, suffix);

        ImportReportResponse create = productImportService.commitImport(jsonFile(createArray), Set.of(), DEV_ADMIN_ID);
        assertThat(create.errorCount()).isZero();

        ProductEntity created = productJpaRepository.findBySlug(slug).orElseThrow();
        assertThat(created.isGenderMale()).isTrue();
        assertThat(created.isGenderFemale()).isTrue();

        ProductImportService.ProductExportFile exported =
                productImportService.exportProductAsTemplateJson(created.getId());
        ProductImportRow[] exportedRows = new ObjectMapper().readValue(exported.content(), ProductImportRow[].class);
        assertThat(exportedRows).singleElement().satisfies(row ->
                assertThat(row.getGenders()).containsExactly("Nam", "Nữ"));

        ImportReportResponse reimport = productImportService.commitImport(
                new MockMultipartFile("file", "reimport.json", "application/json",
                        exported.content()),
                Set.of(), DEV_ADMIN_ID);
        assertThat(reimport.errorCount()).isZero();
        ProductEntity afterReimport = productJpaRepository.findBySlug(slug).orElseThrow();
        assertThat(afterReimport.isGenderMale()).isTrue();
        assertThat(afterReimport.isGenderFemale()).isTrue();
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
                    "gender": "Nam",
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
                    "gender": "Nam",
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
                    "gender": "Nam",
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
                    "gender": "Nam",
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
                    "gender": "Nam",
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
     * PRODUCT_RULE_009: a brand-new product created via bulk import always saves as DRAFT —
     * publishStatus from the file is ignored without warning, including legacy values. An update
     * row ignores the file's publishStatus too, but every product this loop updates started (and
     * stays) DRAFT, so "ignored" and "forced" look identical here. {@link
     * #updatingPublishedProductViaImportKeepsItLive} is what actually proves an update never
     * touches a product that is already live — this loop alone missed that regression.
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
                    "gender": "Nam",
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

    /**
     * Regression test: HUONG-DAN.md's "Cập nhật nội dung cho sản phẩm ĐÃ CÓ sẵn" section tells
     * shop staff they can safely reimport a JSON file to edit an already-PUBLISHED product's
     * price/content. Before this fix, {@code ProductImportService} forced every row — update
     * included — to request DRAFT, which {@code ProductMutationService#updateProduct} rejected
     * with "Product status changes must use the dedicated lifecycle endpoint" as soon as the
     * entity's real stored status was anything but DRAFT. An update row must leave the product's
     * current live/draft/trash status alone, whatever the file's own publishStatus key says.
     */
    @Test
    void updatingPublishedProductViaImportKeepsItLive() throws Exception {
        String suffix = String.valueOf(System.currentTimeMillis());
        String sku = "RT4-" + suffix;
        String slug = "roundtrip4-" + suffix;

        String createArray = """
                [
                  {
                    "sku": "%s",
                    "slug": { "slugVI": "%s" },
                    "name": { "nameVI": "Round Trip Four %s", "nameEN": "Round Trip Four EN %s" },
                    "categoryId": "mu-bao-hiem",
                    "brandId": "ls2",
                    "gender": "Nam",
                    "retailPrice": 900000,
                    "image": { "url": "%s/products/%s.jpg", "alt": "Ảnh đăng bán" }
                  }
                ]
                """.formatted(sku, slug, suffix, suffix, MEDIA, slug);
        ImportReportResponse createReport =
                productImportService.commitImport(jsonFile(createArray), Set.of(), DEV_ADMIN_ID);
        assertThat(createReport.errorCount()).isZero();
        String productId = createReport.rows().get(0).productId();

        // Import discards the image field even on create (PRODUCT_RULE_009), so this simulates
        // the realistic prior state instead: an admin published this product for real, through
        // the real /publish endpoint, after adding a main image — which is why that endpoint's
        // publish-readiness gate would have required one at the time.
        ProductEntity entity = productJpaRepository.findById(productId).orElseThrow();
        entity.setPublishStatus(PublishStatus.PUBLISHED);
        entity.setImageUrl(MEDIA + "/products/" + slug + ".jpg");
        productJpaRepository.save(entity);

        String updateArray = """
                [
                  { "sku": "%s", "categoryId": "mu-bao-hiem", "retailPrice": 950000, "publishStatus": "DRAFT" }
                ]
                """.formatted(sku);
        ImportReportResponse update =
                productImportService.commitImport(jsonFile(updateArray), Set.of(), DEV_ADMIN_ID);

        assertThat(update.errorCount())
                .as("updating a live product's price via import must not error")
                .isZero();
        assertThat(update.rows().get(0).status()).isEqualTo("OK");
        assertThat(productJpaRepository.findBySlug(slug))
                .as("import must not take a published product offline, even when the file says publishStatus DRAFT")
                .hasValueSatisfying(p -> {
                    assertThat(p.getPublishStatus()).isEqualTo(PublishStatus.PUBLISHED);
                    assertThat(p.getRetailPrice()).isEqualByComparingTo("950000");
                });
    }

    /**
     * Owner decision 2026-08-08 (PRODUCT_RULE_009): a CREATE row never produces variants, however
     * many the file lists. The file's variants are reported as ignored rather than dropped silently.
     */
    @Test
    void createIgnoresVariantsInFileAndWarns() throws Exception {
        String suffix = String.valueOf(System.currentTimeMillis());
        String sku = "RT5-" + suffix;
        String slug = "roundtrip5-" + suffix;

        String createArray = """
                [
                  {
                    "sku": "%s",
                    "slug": { "slugVI": "%s" },
                    "name": { "nameVI": "Round Trip Five %s", "nameEN": "Round Trip Five EN %s" },
                    "categoryId": "mu-bao-hiem",
                    "brandId": "ls2",
                    "gender": "Nam",
                    "retailPrice": 800000,
                    "variants": [
                      { "sku": "%s-DEN", "retailPrice": 810000, "isAvailable": true,
                        "options": [ { "optionName": "Color", "optionValue": "Den" } ] },
                      { "sku": "%s-TRANG", "retailPrice": 820000, "isAvailable": true,
                        "options": [ { "optionName": "Color", "optionValue": "Trang" } ] }
                    ]
                  }
                ]
                """.formatted(sku, slug, suffix, suffix, sku, sku);

        ImportReportResponse report =
                productImportService.commitImport(jsonFile(createArray), Set.of(), DEV_ADMIN_ID);
        assertThat(report.errorCount()).isZero();

        ImportRowResult row = report.rows().get(0);
        assertThat(row.action()).isEqualTo("CREATE");
        assertThat(row.status()).as("an ignored variants array downgrades the row to WARNING").isEqualTo("WARNING");
        assertThat(row.warnings())
                .anyMatch(w -> "variants".equals(w.field()) && "IGNORED".equals(w.code()));

        // findByIdsWithVariants: getVariants() is LAZY, so it must be fetch-joined to read it here.
        ProductEntity created = productJpaRepository
                .findByIdsWithVariants(java.util.List.of(row.productId()))
                .get(0);
        assertThat(created.getVariants())
                .as("import never creates variants — admin adds them on the product screen")
                .isEmpty();
    }

    /**
     * Owner decision 2026-08-08 (PRODUCT_RULE_009): with no variants to carry a price, a CREATE row
     * must supply a product-level retailPrice. The publish-readiness gate that enforces this throws
     * an ApiException, so it must fail only that row — the rest of the file still saves.
     */
    @Test
    void createWithoutRetailPriceFailsOnlyThatRow() throws Exception {
        String suffix = String.valueOf(System.currentTimeMillis());
        String badSku = "RT6-BAD-" + suffix;
        String goodSku = "RT6-OK-" + suffix;
        String goodSlug = "roundtrip6-ok-" + suffix;

        String array = """
                [
                  {
                    "sku": "%s",
                    "slug": { "slugVI": "roundtrip6-bad-%s" },
                    "name": { "nameVI": "Round Trip Six Bad %s", "nameEN": "Round Trip Six Bad EN %s" },
                    "categoryId": "mu-bao-hiem",
                    "brandId": "ls2",
                    "gender": "Nam"
                  },
                  {
                    "sku": "%s",
                    "slug": { "slugVI": "%s" },
                    "name": { "nameVI": "Round Trip Six Ok %s", "nameEN": "Round Trip Six Ok EN %s" },
                    "categoryId": "mu-bao-hiem",
                    "brandId": "ls2",
                    "gender": "Nam",
                    "retailPrice": 700000
                  }
                ]
                """.formatted(badSku, suffix, suffix, suffix, goodSku, goodSlug, suffix, suffix);

        ImportReportResponse report =
                productImportService.commitImport(jsonFile(array), Set.of(), DEV_ADMIN_ID);

        assertThat(report.errorCount()).as("only the price-less row fails").isEqualTo(1);
        assertThat(report.rows().get(0).status()).isEqualTo("ERROR");
        assertThat(report.rows().get(0).errors())
                .anyMatch(e -> "retailPrice".equals(e.field()));
        assertThat(report.rows().get(1).status()).isEqualTo("OK");
        assertThat(productJpaRepository.findBySlug(goodSlug))
                .as("a failing row must not roll back rows already committed")
                .isPresent();
    }
}
