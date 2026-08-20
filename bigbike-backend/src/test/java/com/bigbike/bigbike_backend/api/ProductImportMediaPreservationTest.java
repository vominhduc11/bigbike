package com.bigbike.bigbike_backend.api;

import static org.assertj.core.api.Assertions.assertThat;

import com.bigbike.bigbike_backend.api.admin.dto.GalleryImageRequest;
import com.bigbike.bigbike_backend.api.admin.dto.ImageAssetRequest;
import com.bigbike.bigbike_backend.api.admin.dto.ImportReportResponse;
import com.bigbike.bigbike_backend.api.admin.dto.ProductTranslationRequest;
import com.bigbike.bigbike_backend.api.admin.dto.UpsertProductRequest;
import com.bigbike.bigbike_backend.api.admin.dto.VariantOptionRequest;
import com.bigbike.bigbike_backend.api.admin.dto.VariantRequest;
import com.bigbike.bigbike_backend.api.admin.dto.VideoRequest;
import com.bigbike.bigbike_backend.domain.catalog.Product;
import com.bigbike.bigbike_backend.domain.catalog.ProductVariant;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.persistence.entity.catalog.AttributeEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.AttributeValueEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.AttributeJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.AttributeValueJpaRepository;
import com.bigbike.bigbike_backend.repository.catalog.CatalogReadRepository;
import com.bigbike.bigbike_backend.service.admin.ProductImportService;
import com.bigbike.bigbike_backend.service.admin.ProductMutationService;
import com.bigbike.bigbike_backend.util.ProductSlugGenerator;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.List;
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
 * must never let the file write image/gallery/video data. Bulk import is a draft data-entry flow:
 * media fields may exist in an exported file, but import discards them before validation/saving.
 *
 * <p>Owner decision 2026-08-08 extends the same guarantee to the whole {@code variants} array —
 * a file can no longer add, edit or delete variants, so the update below must leave the existing
 * variant byte-for-byte alone (price included) and must not create the second variant it lists.
 */
@SpringBootTest
@Sql(scripts = "/db/test-seed.sql", executionPhase = Sql.ExecutionPhase.BEFORE_TEST_CLASS)
class ProductImportMediaPreservationTest {

    private static final UUID DEV_ADMIN_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final String MEDIA = "http://localhost:9000/bigbike-media";
    private final ObjectMapper mapper = new ObjectMapper();

    @Autowired
    private ProductImportService productImportService;

    @Autowired
    private ProductMutationService productMutationService;

    @Autowired
    private CatalogReadRepository catalogReadRepository;

    @Autowired
    private AttributeJpaRepository attributeJpaRepository;

    @Autowired
    private AttributeValueJpaRepository attributeValueJpaRepository;

    private static MultipartFile jsonFile(String body) {
        return new MockMultipartFile("file", "products.json", "application/json",
                body.getBytes(StandardCharsets.UTF_8));
    }

    private static ProductVariant findVariantBySku(Product product, String sku) {
        return product.variants().stream()
                .filter(v -> sku.equals(v.sku()))
                .findFirst()
                .orElse(null);
    }

    private JsonNode firstExportRow(byte[] exported) throws Exception {
        return mapper.readTree(exported).get(0);
    }

    private VariantOptionRequest variantOption(String name, String value) {
        return VariantOptionRequest.builder()
                .optionName(name)
                .optionValue(value)
                .attributeValueId(ensureAttributeValue(name, value).getId())
                .build();
    }

    private AttributeValueEntity ensureAttributeValue(String name, String label) {
        String code = ProductSlugGenerator.toSlug(name);
        AttributeEntity attribute = attributeJpaRepository.findByCode(code).orElseGet(() -> {
            AttributeEntity created = new AttributeEntity();
            created.setId("test-import-option-attribute-" + UUID.randomUUID());
            created.setCode(code);
            created.setName(name);
            created.setKind("select");
            created.setVariation(true);
            return attributeJpaRepository.save(created);
        });
        String slug = ProductSlugGenerator.toSlug(label);
        return attributeValueJpaRepository.findByAttributeIdAndSlug(attribute.getId(), slug).orElseGet(() -> {
            AttributeValueEntity created = new AttributeValueEntity();
            created.setId("test-import-option-value-" + UUID.randomUUID());
            created.setAttribute(attribute);
            created.setSlug(slug);
            created.setLabel(label);
            created.setSortOrder(0);
            return attributeValueJpaRepository.save(created);
        });
    }

    @Test
    void updateImportNeverOverwritesMedia() throws Exception {
        String suffix = String.valueOf(System.currentTimeMillis());
        String sku = "MP-" + suffix;
        String slug = "media-preserve-" + suffix;
        String denSku = sku + "-DEN";
        String vangSku = sku + "-VANG";

        UpsertProductRequest create = new UpsertProductRequest();
        create.setSku(sku);
        create.setSlug(slug);
        create.setName("Media Preserve " + suffix);
        create.setTranslations(new ProductTranslationRequest(
                ProductTranslationRequest.ProductContentRequest.builder()
                        .name("Media Preserve EN " + suffix)
                        .build()));
        create.setCategoryId("cat_helmet");
        create.setBrandId("brand_ls2");
        create.setGender("Nam");
        create.setRetailPrice(new BigDecimal("1000000"));
        create.setCurrency("VND");
        create.setPublishStatus(PublishStatus.DRAFT);
        create.setShortDescription("<p>Mo ta ban dau</p>");
        create.setImage(ImageAssetRequest.builder()
                .url(MEDIA + "/products/" + slug + ".jpg")
                .alt("Anh goc")
                .build());
        create.setGallery(List.of(GalleryImageRequest.builder()
                .mediaType("image")
                .url(MEDIA + "/products/" + slug + "-g1.jpg")
                .alt("G1 goc")
                .sortOrder(0)
                .build()));
        create.setVideos(List.of(VideoRequest.builder()
                .url("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
                .provider("youtube")
                .title("Video goc")
                .sortOrder(0)
                .build()));

        VariantRequest denCreate = new VariantRequest();
        denCreate.setSku(denSku);
        denCreate.setRetailPrice(new BigDecimal("1000000"));
        denCreate.setIsAvailable(true);
        denCreate.setSortOrder(0);
        denCreate.setOptions(List.of(variantOption("Color", "Den")));
        denCreate.setImageUrl(MEDIA + "/variants/" + slug + "-den.jpg");
        denCreate.setImageAlt("Den goc");
        create.setVariants(List.of(denCreate));

        Product created = productMutationService.createProduct(create, DEV_ADMIN_ID);
        assertThat(created.id()).as("created product id").isNotBlank();

        JsonNode exported = firstExportRow(productImportService.exportProductAsTemplateJson(created.id()).content());
        assertThat(exported).as("created product appears in product JSON export").isNotNull();
        assertThat(exported.path("publishStatus").asText()).isEqualTo("DRAFT");
        assertThat(exported.path("image").path("url").asText()).endsWith(slug + ".jpg");
        assertThat(exported.path("gallery").get(0).path("url").asText()).endsWith(slug + "-g1.jpg");
        assertThat(exported.path("videos").get(0).path("title").asText()).isEqualTo("Video goc");
        assertThat(exported.path("variants").get(0).hasNonNull("id")).isTrue();
        assertThat(exported.path("variants").get(0).path("imageUrl").asText()).endsWith(slug + "-den.jpg");

        String updateArray = """
                [
                  {
                    "sku": "%s",
                    "slug": { "slugVI": "%s" },
                    "categoryId": "mu-bao-hiem",
                    "brandId": "ls2",
                    "retailPrice": 1000000,
                    "shortDescription": { "shortDescriptionVI": "<p>Mo ta MOI da doi</p>" },
                    "name": { "nameEN": "Media Preserve EN %s" },
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

        // A file that still carries variants is accepted, but the group is reported as ignored.
        assertThat(updateReport.rows().get(0).warnings())
                .as("row warns that the file's variants were skipped")
                .anyMatch(w -> "variants".equals(w.field()) && "IGNORED".equals(w.code()));

        Product after = catalogReadRepository.findProductById(updateReport.rows().get(0).productId()).orElseThrow();
        assertThat(after).as("product still present after update").isNotNull();

        // Non-media fields DID replace normally.
        assertThat(after.shortDescription())
                .isEqualTo("<p>Mo ta MOI da doi</p>");

        // Product-level media stayed exactly as originally imported — the update file's
        // image/gallery/videos were ignored.
        assertThat(after.image().url()).endsWith(slug + ".jpg");
        assertThat(after.gallery().get(0).image().url()).endsWith(slug + "-g1.jpg");
        assertThat(after.videos().get(0).title()).isEqualTo("Video goc");

        // Existing variant (DEN) is untouched end to end — the file's new price, image and alt were
        // all ignored along with the rest of the variants array.
        assertThat(after.variants()).as("variant list unchanged in size").hasSize(1);
        ProductVariant den = findVariantBySku(after, denSku);
        assertThat(den).as("DEN variant present").isNotNull();
        assertThat(den.price().retailPrice()).isEqualByComparingTo("1000000");
        assertThat(den.image().url()).endsWith(slug + "-den.jpg");
        assertThat(den.image().alt()).isEqualTo("Den goc");

        // The second variant listed in the file is never created — import cannot add variants.
        assertThat(findVariantBySku(after, vangSku)).as("VANG variant not created by import").isNull();
    }
}
