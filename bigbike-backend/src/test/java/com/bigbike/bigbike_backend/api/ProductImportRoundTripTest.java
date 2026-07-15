package com.bigbike.bigbike_backend.api;

import static org.assertj.core.api.Assertions.assertThat;

import com.bigbike.bigbike_backend.api.admin.dto.ImportReportResponse;
import com.bigbike.bigbike_backend.api.admin.dto.ImportRowResult;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.service.admin.ProductImportService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.web.multipart.MultipartFile;

/**
 * Guards the JSON-only round trip: a product created via import, exported by
 * {@link ProductImportService#exportCurrentCatalogAsTemplateJson()}, must re-import as a clean
 * UPDATE (never a duplicate CREATE), the export must not leak the {@code *Present} bookkeeping
 * flags, and re-committing must preserve variant DB identities (SKU-matched, no orphan wipe).
 */
@SpringBootTest
@Sql(scripts = "/db/test-seed.sql", executionPhase = Sql.ExecutionPhase.BEFORE_TEST_CLASS)
class ProductImportRoundTripTest {

    private static final UUID DEV_ADMIN_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final String MEDIA = "http://localhost:9000/bigbike-media";

    private final ObjectMapper mapper = new ObjectMapper();

    @Autowired
    private ProductImportService productImportService;

    @Autowired
    private ProductJpaRepository productJpaRepository;

    private static MultipartFile jsonFile(String body) {
        return new MockMultipartFile("file", "products.json", "application/json",
                body.getBytes(StandardCharsets.UTF_8));
    }

    private static Map<String, String> variantIdBySku(JsonNode product) {
        Map<String, String> ids = new HashMap<>();
        for (JsonNode v : product.path("variants")) {
            ids.put(v.path("sku").asText(), v.path("id").asText());
        }
        return ids;
    }

    private JsonNode findBySku(byte[] exported, String sku) throws Exception {
        for (JsonNode node : mapper.readTree(exported)) {
            if (sku.equals(node.path("sku").asText())) {
                return node;
            }
        }
        return null;
    }

    @Test
    void exportedCatalogReimportsAsLosslessUpdate() throws Exception {
        String suffix = String.valueOf(System.currentTimeMillis());
        String sku = "RT-" + suffix;
        String slug = "roundtrip-" + suffix;

        String createArray = """
                [
                  {
                    "sku": "%s",
                    "slug": { "slugVI": "%s" },
                    "name": { "nameVI": "Round Trip %s", "nameEN": "Round Trip EN %s" },
                    "categoryId": "mu-bao-hiem",
                    "brandId": "ls2",
                    "gender": "Unisex",
                    "retailPrice": 2500000,
                    "salePrice": 2300000,
                    "currency": "VND",
                    "shortDescription": { "shortDescriptionVI": "<p>Mô tả ngắn</p>", "shortDescriptionEN": "<p>Short EN</p>" },
                    "seo": { "titleVI": "SEO %s", "descriptionVI": "SEO desc" },
                    "image": { "url": "%s/products/%s.jpg", "alt": "Ảnh đại diện" },
                    "gallery": [ { "mediaType": "image", "url": "%s/products/%s-g1.jpg", "alt": "G1", "sortOrder": 0 } ],
                    "descriptionBlocks": [
                      { "type": "heading", "level": 2, "text": "Tiêu đề" },
                      { "type": "paragraph", "html": "<p>Nội dung chi tiết</p>" }
                    ],
                    "specStats": { "specStatsVI": "<div>35h – Pin</div>" },
                    "trustBadges": { "trustBadgesVI": "<div>Bảo hành 24 tháng</div>" },
                    "commitments": [ { "icon": "shield-check", "title": "Chính hãng", "subtitle": "100%%", "sortOrder": 0 } ],
                    "faqs": [ { "question": "Câu hỏi?", "answer": "<p>Trả lời</p>", "sortOrder": 0 } ],
                    "highlights": {
                      "positiveNotes": [ { "content": "Ưu điểm 1", "sortOrder": 0 } ],
                      "negativeNotes": [ { "content": "Nhược điểm 1", "sortOrder": 0 } ]
                    },
                    "variants": [
                      { "sku": "%s-M", "retailPrice": 2500000, "isAvailable": true, "options": [ { "optionName": "Size", "optionValue": "M" } ] },
                      { "sku": "%s-L", "retailPrice": 2600000, "isAvailable": true, "options": [ { "optionName": "Size", "optionValue": "L" } ] }
                    ]
                  }
                ]
                """.formatted(sku, slug, suffix, suffix, suffix, MEDIA, slug, MEDIA, slug, sku, sku);

        // ── 1. Create via import ──
        ImportReportResponse createReport =
                productImportService.commitImport(jsonFile(createArray), Set.of(), DEV_ADMIN_ID);
        assertThat(createReport.errorCount()).as("create import has no errors").isZero();
        assertThat(createReport.rows()).anyMatch(r -> "CREATE".equals(r.action()));
        assertThat(productJpaRepository.findBySlug(slug)).as("product persisted").isPresent();

        // ── 2. Export the catalog as JSON ──
        byte[] exported = productImportService.exportCurrentCatalogAsTemplateJson();
        String exportedStr = new String(exported, StandardCharsets.UTF_8);

        // The ~23 *Present bookkeeping getters must never leak into the file (would clobber
        // an untouched field on re-import).
        assertThat(exportedStr).doesNotContain("skuPresent");
        assertThat(exportedStr).doesNotContain("Present\"");

        JsonNode mine = findBySku(exported, sku);
        assertThat(mine).as("our product is present in the export").isNotNull();
        assertThat(mine.path("categoryId").asText()).as("category emitted as slug").isEqualTo("mu-bao-hiem");
        assertThat(mine.path("brandId").asText()).as("brand emitted as slug").isEqualTo("ls2");
        assertThat(mine.path("variants")).hasSize(2);
        assertThat(mine.path("faqs")).hasSize(1);
        assertThat(mine.path("descriptionBlocks").size()).isEqualTo(2);
        Map<String, String> variantIdsBefore = variantIdBySku(mine);

        // Isolate our product (seed rows may lack an EN name and would ERROR on validate).
        ArrayNode single = mapper.createArrayNode().add(mine);
        String reimport = mapper.writeValueAsString(single);

        // ── 3. Re-validate: our product round-trips as a clean UPDATE, not a duplicate CREATE ──
        ImportReportResponse validate = productImportService.validateImport(jsonFile(reimport));
        assertThat(validate.errorCount()).as("re-import validate has no errors").isZero();
        ImportRowResult row = validate.rows().get(0);
        assertThat(row.action()).isEqualTo("UPDATE");
        assertThat(row.status()).isNotEqualTo("ERROR");

        // ── 4. Re-commit: variant DB identities preserved (SKU-matched, no orphan wipe) ──
        productImportService.commitImport(jsonFile(reimport), Set.of(), DEV_ADMIN_ID);
        JsonNode after = findBySku(productImportService.exportCurrentCatalogAsTemplateJson(), sku);
        assertThat(after).isNotNull();
        assertThat(variantIdBySku(after))
                .as("variant ids preserved across export → re-import")
                .isEqualTo(variantIdsBefore);
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

        JsonNode after = findBySku(productImportService.exportCurrentCatalogAsTemplateJson(), sku);
        assertThat(after).isNotNull();
        assertThat(after.path("name").path("nameEN").asText())
                .as("existing English name is preserved when the update file doesn't touch it")
                .isEqualTo(enName);
        assertThat(after.path("retailPrice").asDouble())
                .as("the field the file did touch was actually updated")
                .isEqualTo(1200000.0);
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

    /**
     * PRODUCT_RULE_009: legacy publishStatus values (HIDDEN/ARCHIVED/PENDING/PRIVATE) in an
     * update-existing-product import row must be skipped with a WARNING (IGNORED), never applied
     * and never a hard row ERROR — matching how PUBLISHED is already handled. Regression test for
     * the bug where these values previously flowed to validatePublishTransition and errored the
     * whole row instead of warning-and-skipping (fixed alongside HIDDEN retirement, 2026-07-07).
     */
    @Test
    void legacyPublishStatusOnUpdateImportIsIgnoredWithWarningNotError() {
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
                    "retailPrice": 900000
                  }
                ]
                """.formatted(sku, slug, suffix, suffix);
        ImportReportResponse createReport =
                productImportService.commitImport(jsonFile(createArray), Set.of(), DEV_ADMIN_ID);
        assertThat(createReport.errorCount()).isZero();

        for (String legacyStatus : new String[] {"HIDDEN", "ARCHIVED", "PENDING", "PRIVATE"}) {
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
            assertThat(row.status()).as(legacyStatus + " row status").isEqualTo("WARNING");
            assertThat(row.warnings())
                    .as(legacyStatus + " produces an IGNORED warning on publishStatus")
                    .anyMatch(w -> "publishStatus".equals(w.field()) && "IGNORED".equals(w.code()));

            assertThat(productJpaRepository.findBySlug(slug))
                    .as(legacyStatus + " must not overwrite the product's current publishStatus")
                    .hasValueSatisfying(entity ->
                            assertThat(entity.getPublishStatus()).isEqualTo(com.bigbike.bigbike_backend.domain.catalog.PublishStatus.DRAFT));
        }
    }
}
