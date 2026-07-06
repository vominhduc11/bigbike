package com.bigbike.bigbike_backend.api;

import static org.assertj.core.api.Assertions.assertThat;

import com.bigbike.bigbike_backend.api.admin.dto.ImportReportResponse;
import com.bigbike.bigbike_backend.service.admin.ProductImportService;
import com.fasterxml.jackson.databind.JsonNode;
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
 * Owner decision 2026-07-06 (extends {@code PRODUCT_RULE_009}): re-importing JSON for a product
 * that already exists must never let the file overwrite its image/gallery/video — at product
 * level or on any variant the file matches back to an existing DB variant by SKU. Every other
 * field in the row still replaces normally. A brand-new variant added by the same update file has
 * no old media to protect, so its own image passes through untouched.
 */
@SpringBootTest
@Sql(scripts = "/db/test-seed.sql", executionPhase = Sql.ExecutionPhase.BEFORE_TEST_CLASS)
class ProductImportMediaPreservationTest {

    private static final UUID DEV_ADMIN_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final String MEDIA = "http://localhost:9000/bigbike-media";

    private final ObjectMapper mapper = new ObjectMapper();

    @Autowired
    private ProductImportService productImportService;

    private static MultipartFile jsonFile(String body) {
        return new MockMultipartFile("file", "products.json", "application/json",
                body.getBytes(StandardCharsets.UTF_8));
    }

    private JsonNode findBySku(byte[] exported, String sku) throws Exception {
        for (JsonNode node : mapper.readTree(exported)) {
            if (sku.equals(node.path("sku").asText())) {
                return node;
            }
        }
        return null;
    }

    private static JsonNode findVariantBySku(JsonNode product, String sku) {
        for (JsonNode v : product.path("variants")) {
            if (sku.equals(v.path("sku").asText())) {
                return v;
            }
        }
        return null;
    }

    @Test
    void updateImportNeverOverwritesMedia() throws Exception {
        String suffix = String.valueOf(System.currentTimeMillis());
        String sku = "MP-" + suffix;
        String slug = "media-preserve-" + suffix;
        String denSku = sku + "-DEN";
        String vangSku = sku + "-VANG";

        String createArray = """
                [
                  {
                    "sku": "%s",
                    "slug": "%s",
                    "name": "Media Preserve %s",
                    "categoryId": "mu-bao-hiem",
                    "brandId": "ls2",
                    "gender": "Unisex",
                    "retailPrice": 1000000,
                    "shortDescription": "<p>Mo ta ban dau</p>",
                    "translations": { "en": { "name": "Media Preserve EN %s" } },
                    "image": { "url": "%s/products/%s.jpg", "alt": "Anh goc" },
                    "gallery": [ { "mediaType": "image", "url": "%s/products/%s-g1.jpg", "alt": "G1 goc", "sortOrder": 0 } ],
                    "videos": [ { "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "provider": "youtube", "title": "Video goc", "sortOrder": 0 } ],
                    "variants": [
                      { "sku": "%s", "retailPrice": 1000000, "isAvailable": true,
                        "options": [ { "optionName": "Color", "optionValue": "Den" } ],
                        "imageUrl": "%s/variants/%s-den.jpg", "imageAlt": "Den goc" }
                    ]
                  }
                ]
                """.formatted(sku, slug, suffix, suffix, MEDIA, slug, MEDIA, slug, denSku, MEDIA, slug);

        ImportReportResponse createReport =
                productImportService.commitImport(jsonFile(createArray), Set.of(), DEV_ADMIN_ID);
        assertThat(createReport.errorCount()).as("create import has no errors").isZero();

        String updateArray = """
                [
                  {
                    "sku": "%s",
                    "slug": "%s",
                    "categoryId": "mu-bao-hiem",
                    "brandId": "ls2",
                    "retailPrice": 1000000,
                    "shortDescription": "<p>Mo ta MOI da doi</p>",
                    "translations": { "en": { "name": "Media Preserve EN %s" } },
                    "image": { "url": "%s/products/%s-NEW.jpg", "alt": "Anh MOI" },
                    "gallery": [ { "mediaType": "image", "url": "%s/products/%s-g1-NEW.jpg", "alt": "G1 MOI", "sortOrder": 0 } ],
                    "videos": [ { "url": "https://www.youtube.com/watch?v=NEWNEWNEWNE", "provider": "youtube", "title": "Video MOI", "sortOrder": 0 } ],
                    "variants": [
                      { "sku": "%s", "retailPrice": 1200000, "isAvailable": true,
                        "options": [ { "optionName": "Color", "optionValue": "Den" } ],
                        "imageUrl": "%s/variants/%s-den-NEW.jpg", "imageAlt": "Den MOI" },
                      { "sku": "%s", "retailPrice": 1100000, "isAvailable": true,
                        "options": [ { "optionName": "Color", "optionValue": "Vang" } ],
                        "imageUrl": "%s/variants/%s-vang-NEW.jpg", "imageAlt": "Vang MOI" }
                    ]
                  }
                ]
                """.formatted(sku, slug, suffix, MEDIA, slug, MEDIA, slug, denSku, MEDIA, slug, vangSku, MEDIA, slug);

        ImportReportResponse updateReport =
                productImportService.commitImport(jsonFile(updateArray), Set.of(), DEV_ADMIN_ID);
        assertThat(updateReport.errorCount()).as("update import has no errors").isZero();
        assertThat(updateReport.rows()).anyMatch(r -> "UPDATE".equals(r.action()));

        JsonNode after = findBySku(productImportService.exportCurrentCatalogAsTemplateJson(), sku);
        assertThat(after).as("product still present after update").isNotNull();

        // Non-media fields DID replace normally.
        assertThat(after.path("shortDescription").asText()).isEqualTo("<p>Mo ta MOI da doi</p>");

        // Product-level media stayed exactly as originally imported — the update file's
        // image/gallery/videos were ignored.
        assertThat(after.path("image").path("url").asText()).endsWith(slug + ".jpg");
        assertThat(after.path("gallery").get(0).path("url").asText()).endsWith(slug + "-g1.jpg");
        assertThat(after.path("videos").get(0).path("title").asText()).isEqualTo("Video goc");

        // Matched existing variant (DEN): price replaced normally, but its own image/alt stayed old.
        JsonNode den = findVariantBySku(after, denSku);
        assertThat(den).as("DEN variant present").isNotNull();
        assertThat(den.path("retailPrice").asLong()).isEqualTo(1200000L);
        assertThat(den.path("imageUrl").asText()).endsWith(slug + "-den.jpg");
        assertThat(den.path("imageAlt").asText()).isEqualTo("Den goc");

        // Brand-new variant (VANG) has no old media to protect — the file's image passes through.
        JsonNode vang = findVariantBySku(after, vangSku);
        assertThat(vang).as("VANG variant present").isNotNull();
        assertThat(vang.path("imageUrl").asText()).endsWith(slug + "-vang-NEW.jpg");
        assertThat(vang.path("imageAlt").asText()).isEqualTo("Vang MOI");
    }
}
