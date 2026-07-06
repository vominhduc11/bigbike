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
                    "slug": "%s",
                    "name": "Round Trip %s",
                    "categoryId": "mu-bao-hiem",
                    "brandId": "ls2",
                    "gender": "Unisex",
                    "retailPrice": 2500000,
                    "salePrice": 2300000,
                    "currency": "VND",
                    "shortDescription": "<p>Mô tả ngắn</p>",
                    "translations": { "en": { "name": "Round Trip EN %s", "shortDescription": "<p>Short EN</p>" } },
                    "seo": { "title": "SEO %s", "description": "SEO desc" },
                    "image": { "url": "%s/products/%s.jpg", "alt": "Ảnh đại diện" },
                    "gallery": [ { "mediaType": "image", "url": "%s/products/%s-g1.jpg", "alt": "G1", "sortOrder": 0 } ],
                    "descriptionBlocks": [
                      { "type": "heading", "level": 2, "text": "Tiêu đề" },
                      { "type": "paragraph", "html": "<p>Nội dung chi tiết</p>" }
                    ],
                    "specStats": [ { "value": "35h", "label": "Pin", "sortOrder": 0 } ],
                    "trustBadges": [ { "content": "Bảo hành 24 tháng", "sortOrder": 0 } ],
                    "commitments": [ { "icon": "shield-check", "title": "Chính hãng", "subtitle": "100%%", "sortOrder": 0 } ],
                    "faqs": [ { "question": "Câu hỏi?", "answer": "<p>Trả lời</p>", "sortOrder": 0 } ],
                    "positiveNotes": [ { "content": "Ưu điểm 1", "sortOrder": 0 } ],
                    "negativeNotes": [ { "content": "Nhược điểm 1", "sortOrder": 0 } ],
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
}
