package com.bigbike.bigbike_backend.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.domain.catalog.DescriptionBlock;
import com.bigbike.bigbike_backend.domain.catalog.GalleryMedia;
import com.bigbike.bigbike_backend.domain.catalog.ImageAsset;
import com.bigbike.bigbike_backend.domain.catalog.ProductCommitment;
import com.bigbike.bigbike_backend.domain.catalog.ProductFaq;
import com.bigbike.bigbike_backend.domain.catalog.ProductHighlight;
import com.bigbike.bigbike_backend.domain.catalog.ProductHighlights;
import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.api.admin.dto.ProductCsvExportQuery;
import com.bigbike.bigbike_backend.domain.catalog.SizeGuideSection;
import com.bigbike.bigbike_backend.domain.catalog.SuitabilitySection;
import com.bigbike.bigbike_backend.domain.catalog.VideoAsset;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantGalleryImageEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantOptionEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.CategoryJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.junit.jupiter.api.Test;

class FullProductCatalogCsvExportServiceTest {

    @Test
    void plansEveryPresetInContractOrderAndAlwaysKeepsSku() {
        FullProductCatalogCsvExportService service = service();

        ProductCsvExportQuery pricing = query("PRICING");
        assertThat(service.plan(pricing).columns()).containsExactly(
                "sku", "name_vi", "category_names_vi", "brand_name", "retail_price", "sale_price",
                "currency", "stock_state", "stock_quantity", "available", "publish_status");

        ProductCsvExportQuery contentSeo = query("CONTENT_SEO");
        assertThat(service.plan(contentSeo).columns()).containsExactly(
                "sku", "slug", "slug_en", "name_vi", "name_en", "short_description_vi",
                "short_description_en", "seo_title_vi", "seo_title_en", "seo_description_vi",
                "seo_description_en", "seo_canonical_url");

        ProductCsvExportQuery media = query("MEDIA");
        assertThat(service.plan(media).columns()).containsExactly(
                "sku", "name_vi", "image_url", "image_alt", "gallery_json", "videos_json");

        ProductCsvExportQuery custom = query("PRICING");
        custom.setColumns("name_vi,unknown_column,sku");
        assertThat(service.plan(custom).columns()).containsExactly("sku", "name_vi");

        ProductCsvExportQuery groups = query("PRICING");
        groups.setColumnGroups("MEDIA_VIDEO,unknown_group");
        assertThat(service.plan(groups).columns()).containsExactly(
                "sku", "image_id", "image_url", "image_alt", "image_width", "image_height",
                "image_mime_type", "gallery_json", "videos_json");
    }

    @Test
    void defaultAndExplicitStatusesAreNormalizedWithoutCrossScopeLeakage() {
        FullProductCatalogCsvExportService service = service();

        ProductCsvExportQuery defaults = query("PRICING");
        assertThat(service.plan(defaults).publishStatuses()).containsExactly(PublishStatus.PUBLISHED);
        defaults.setIncludeDraft(true);
        defaults.setIncludeTrash(true);
        assertThat(service.plan(defaults).publishStatuses())
                .containsExactlyInAnyOrder(PublishStatus.PUBLISHED, PublishStatus.DRAFT, PublishStatus.TRASH);

        ProductCsvExportQuery explicit = query("PRICING");
        explicit.setPublishStatus("DRAFT");
        explicit.setIncludeTrash(true);
        assertThat(service.plan(explicit).publishStatuses()).containsExactly(PublishStatus.DRAFT);

        ProductCsvExportQuery all = query("FULL");
        all.setScope("ALL");
        all.setQ("screen-filter");
        assertThat(service.plan(all).scope()).isEqualTo(ProductCsvExportScope.ALL);
        assertThat(service.plan(all).q()).isNull();
        assertThat(service.plan(all).publishStatuses()).containsExactlyElementsOf(
                java.util.Arrays.asList(PublishStatus.values()));
    }

    @Test
    void selectedScopeRequiresAtMostTwoHundredUniqueIds() {
        FullProductCatalogCsvExportService service = service();
        ProductCsvExportQuery selected = query("PRICING");
        selected.setScope("SELECTED");
        selected.setIds("p-1,p-1,p-2");
        assertThat(service.plan(selected).selectedIds()).containsExactly("p-1", "p-2");

        selected.setIds(java.util.stream.IntStream.range(0, 201)
                .mapToObj(index -> "p-" + index)
                .collect(java.util.stream.Collectors.joining(",")));
        assertThatThrownBy(() -> service.plan(selected))
                .isInstanceOf(com.bigbike.bigbike_backend.api.error.ValidationException.class)
                .hasMessage("Validation failed.");
    }

    @Test
    void writesContractHeaderAndPreservesNestedCatalogDataAsJson() throws Exception {
        ProductJpaRepository repository = mock(ProductJpaRepository.class);
        ProductEntity product = product("p-001");
        product.setDescriptionBlocks(List.of(DescriptionBlock.ParagraphBlock.builder()
                .type("paragraph").html("<p>Mô tả VI</p>").htmlEn("<p>Description EN</p>").build()));
        product.setFaqs(List.of(new ProductFaq("Câu hỏi", "Trả lời", "Question", "Answer")));
        product.setCommitments(List.of(new ProductCommitment("truck", "Giao nhanh", "Trong ngày", "Fast", "Same day")));
        product.setHighlights(new ProductHighlights(List.of(new ProductHighlight("Ưu điểm", "Pro")), List.of()));
        product.setGallery(List.of(GalleryMedia.ofImage(new ImageAsset("media-1", "/media/cover.jpg", "Ảnh bìa", 1200, 800, "image/jpeg"))));
        product.setVideos(List.of(new VideoAsset("video-1", "https://youtube.com/watch?v=1", "Video hướng dẫn", null, "youtube", "Mô tả video")));
        product.setSuitabilitySection(SuitabilitySection.builder().title("Phù hợp").titleEn("Suitable").html("<p>VI</p>").htmlEn("<p>EN</p>").build());
        product.setSizeGuideSection(SizeGuideSection.builder().title("Bảng size").titleEn("Size guide").html("<p>M</p>").htmlEn("<p>M EN</p>").build());
        product.setSeoTitle("SEO VI"); product.setSeoTitleEn("SEO EN"); product.setSeoDescription("Mô tả SEO"); product.setSeoDescriptionEn("SEO description");
        product.setRelatedProducts(List.of(product("related-1")));
        product.setAccessoryProducts(List.of(product("accessory-1")));
        ProductVariantEntity variant = new ProductVariantEntity();
        variant.setId("variant-1"); variant.setSku("VAR-1"); variant.setName("Đỏ - M"); variant.setRetailPrice(new BigDecimal("150000"));
        variant.setStockState(ProductStockState.IN_STOCK); variant.setAvailable(true); variant.setSortOrder(2);
        ProductVariantOptionEntity option = new ProductVariantOptionEntity();
        option.setId(11L); option.setOptionName("Màu sắc"); option.setOptionValue("Đỏ"); option.setSortOrder(1);
        ProductVariantGalleryImageEntity variantImage = new ProductVariantGalleryImageEntity();
        variantImage.setId(12L); variantImage.setSortOrder(1); variantImage.setMediaType("image"); variantImage.setImageUrl("/media/variant.jpg");
        variant.setOptions(List.of(option)); variant.setGallery(List.of(variantImage)); product.setVariants(List.of(variant));
        when(repository.findForCsvAfterId(any(), any(), any())).thenReturn(List.of(product), List.of());

        ByteArrayOutputStream output = new ByteArrayOutputStream();
        FullProductCatalogCsvExportService service = new FullProductCatalogCsvExportService(
                repository, mock(jakarta.persistence.EntityManager.class), mock(CategoryJpaRepository.class));
        ProductCsvExportQuery query = new ProductCsvExportQuery();
        query.setScope("ALL");
        query.setPreset("FULL");
        service.writeTo(output, service.plan(query), ignored -> { });

        byte[] bytes = output.toByteArray();
        assertThat(bytes).startsWith((byte) 0xEF, (byte) 0xBB, (byte) 0xBF);
        try (CSVParser csv = CSVParser.parse(new String(bytes, 3, bytes.length - 3, java.nio.charset.StandardCharsets.UTF_8), CSVFormat.DEFAULT.builder().setHeader().setSkipHeaderRecord(true).build())) {
            CSVRecord row = csv.getRecords().get(0);
            assertThat(new ArrayList<>(csv.getHeaderMap().keySet())).containsExactlyElementsOf(FullProductCatalogCsvExportService.HEADERS);
            assertThat(row.get("name_en")).isEqualTo("Product EN");
            assertThat(row.get("seo_title_en")).isEqualTo("SEO EN");
            assertThat(row.get("description_blocks_json")).contains("Description EN");
            assertThat(row.get("suitability_section_json")).contains("Suitable");
            assertThat(row.get("size_guide_section_json")).contains("Size guide");
            assertThat(row.get("faqs_json")).contains("Question");
            assertThat(row.get("commitments_json")).contains("Giao nhanh");
            assertThat(row.get("gallery_json")).contains("cover.jpg");
            assertThat(row.get("videos_json")).contains("Video hướng dẫn");
            assertThat(row.get("variants_json")).contains("VAR-1").contains("Màu sắc").contains("variant.jpg");
            assertThat(row.get("related_products_json")).contains("related-1");
            assertThat(row.get("accessory_products_json")).contains("accessory-1");
        }
    }

    @Test
    void streamsMoreThanTheOldTenThousandReportLimitWithoutTruncation() throws Exception {
        ProductJpaRepository repository = mock(ProductJpaRepository.class);
        when(repository.findForCsvAfterId(any(), any(), any())).thenAnswer(invocation -> {
            String afterId = invocation.getArgument(1);
            int start = afterId == null ? 0 : Integer.parseInt(afterId.substring(1));
            if (start >= 10_001) return List.of();
            List<ProductEntity> page = new ArrayList<>();
            for (int i = start + 1; i <= Math.min(start + FullProductCatalogCsvExportService.PAGE_SIZE, 10_001); i++) {
                page.add(product(String.format("p%05d", i)));
            }
            return page;
        });

        ByteArrayOutputStream output = new ByteArrayOutputStream();
        FullProductCatalogCsvExportService service = new FullProductCatalogCsvExportService(
                repository, mock(jakarta.persistence.EntityManager.class), mock(CategoryJpaRepository.class));
        ProductCsvExportQuery query = new ProductCsvExportQuery();
        query.setScope("ALL");
        query.setPreset("FULL");
        service.writeTo(output, service.plan(query), ignored -> { });
        long rows = new String(output.toByteArray(), java.nio.charset.StandardCharsets.UTF_8).lines().count() - 1;
        assertThat(rows).isEqualTo(10_001);
    }

    private static FullProductCatalogCsvExportService service() {
        return new FullProductCatalogCsvExportService(
                mock(ProductJpaRepository.class),
                mock(jakarta.persistence.EntityManager.class),
                mock(CategoryJpaRepository.class));
    }

    private static ProductCsvExportQuery query(String preset) {
        ProductCsvExportQuery query = new ProductCsvExportQuery();
        query.setPreset(preset);
        return query;
    }

    private static ProductEntity product(String id) {
        ProductEntity product = new ProductEntity();
        product.setId(id); product.setSku("SKU-" + id); product.setSlug(id); product.setName("Sản phẩm " + id); product.setNameEn("Product EN");
        product.setRetailPrice(new BigDecimal("100000")); product.setCurrency("VND"); product.setStockState(ProductStockState.IN_STOCK); product.setPublishStatus(PublishStatus.DRAFT);
        product.setCreatedAt(Instant.parse("2026-07-19T00:00:00Z")); product.setUpdatedAt(Instant.parse("2026-07-19T00:00:00Z")); product.setVersion(1L);
        product.setVariants(List.of()); product.setGallery(List.of()); product.setVideos(List.of()); product.setRelatedProducts(List.of()); product.setAccessoryProducts(List.of());
        return product;
    }
}
