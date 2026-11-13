package com.bigbike.bigbike_backend.service.catalog;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import javax.sql.DataSource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

class CatalogColorAccessibilityLabelServiceTest {
    private JdbcTemplate jdbc;
    private CatalogColorAccessibilityLabelService service;

    @BeforeEach
    void setUp() {
        jdbc = spy(new JdbcTemplate(dataSource()));
        jdbc.execute("CREATE TABLE catalog_visual_facets (facet_type varchar, facet_key varchar, label_vi varchar, label_en varchar, swatch varchar, sort_order int, active boolean)");
        jdbc.execute("CREATE TABLE catalog_visual_alias_mappings (facet_type varchar, facet_key varchar, alias_key varchar)");
        jdbc.execute("CREATE TABLE catalog_visual_display_terms (source_label varchar, label_en varchar, active boolean)");
        jdbc.update("INSERT INTO catalog_visual_facets VALUES ('COLOR', 'den', 'Đen', 'Black', null, 1, true)");
        jdbc.update("INSERT INTO catalog_visual_display_terms VALUES ('bóng', 'gloss', true), ('ẩn', 'hidden', false)");
        service = new CatalogColorAccessibilityLabelService(new CatalogVisualFacetCatalogService(jdbc), jdbc);
        clearInvocations(jdbc);
    }

    protected DataSource dataSource() {
        return new DriverManagerDataSource(
                "jdbc:h2:mem:color-label-" + java.util.UUID.randomUUID() + ";DB_CLOSE_DELAY=-1", "sa", "");
    }

    @org.junit.jupiter.api.AfterEach
    void cleanUp() {
        jdbc.execute("DROP TABLE catalog_visual_alias_mappings");
        jdbc.execute("DROP TABLE catalog_visual_facets");
        jdbc.execute("DROP TABLE catalog_visual_display_terms");
    }

    @Test
    void reusesTwoVocabularyQueriesAcrossTwentyColorsWithIdenticalResults() {
        List<String> baseline = new ArrayList<>();
        for (int i = 0; i < 20; i++) baseline.add(service.localize("Đen bóng", "en"));
        verify(jdbc, times(40)).query(anyString(), any(RowMapper.class));
        clearInvocations(jdbc);
        var localizer = service.localizer("en");
        List<String> optimized = new ArrayList<>();
        for (int i = 0; i < 20; i++) optimized.add(localizer.apply("Đen bóng"));
        assertThat(optimized).isEqualTo(baseline).containsOnly("Black gloss");
        verify(jdbc, times(2)).query(anyString(), any(RowMapper.class));
        System.out.println("Color vocabulary SELECTs for 20 options: before=40, after=2; equal output=true");
    }

    @Test
    void keepsSnapshotLocalAndRefreshesOnNextMapping() {
        var first = service.localizer("en");
        assertThat(first.apply("Đen bóng ẩn")).isEqualTo("Black gloss ẩn");
        jdbc.update("UPDATE catalog_visual_display_terms SET label_en = 'glossy' WHERE source_label = 'bóng'");
        assertThat(first.apply("Đen bóng")).isEqualTo("Black gloss");
        assertThat(service.localizer("en").apply("Đen bóng")).isEqualTo("Black glossy");
        assertThat(first.apply("Unknown")).isEqualTo("Unknown");
    }

    @Test
    void skipsVocabularyReadsWithoutAnEnglishColor() {
        service.localizer("en");
        assertThat(service.localizer("en").apply(null)).isNull();
        assertThat(service.localizer("vi").apply("Đen bóng")).isNull();
        verify(jdbc, never()).query(anyString(), any(RowMapper.class));
    }

    @Test
    void repositorySharesVocabularyAcrossProductVariantsForDetailAndListing() {
        var products = org.mockito.Mockito.mock(com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository.class);
        var repository = new com.bigbike.bigbike_backend.repository.catalog.JpaCatalogReadRepository(
                products, null, null, null, null, service);
        var product = new com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity();
        product.setId("test-product");
        product.setName("Test product");
        product.setSlug("test-product");
        product.setRetailPrice(java.math.BigDecimal.TEN);
        product.setCurrency("VND");
        var attribute = new com.bigbike.bigbike_backend.persistence.entity.catalog.AttributeEntity();
        attribute.setCode("color");
        attribute.setName("Màu sắc");
        var variants = new ArrayList<com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantEntity>();
        for (int i = 0; i < 20; i++) {
            var variant = new com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantEntity();
            variant.setId("variant-" + i);
            var option = new com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantOptionEntity();
            option.setAttribute(attribute);
            option.setOptionValue("Đen bóng");
            variant.setOptions(List.of(option));
            variants.add(variant);
        }
        product.setVariants(variants);
        org.mockito.Mockito.when(products.findBySlug("test-product")).thenReturn(java.util.Optional.of(product));

        var detail = repository.findProductBySlug("test-product", "en").orElseThrow();
        assertThat(detail.variants()).hasSize(20).allSatisfy(variant ->
                assertThat(variant.options().get(0).accessibilityLabel()).isEqualTo("Black gloss"));
        verify(jdbc, times(2)).query(anyString(), any(RowMapper.class));
        clearInvocations(jdbc);

        var listing = repository.findProductBySlugForListing("test-product", "en").orElseThrow();
        assertThat(listing.variants()).hasSize(20).allSatisfy(variant ->
                assertThat(variant.options().get(0).accessibilityLabel()).isEqualTo("Black gloss"));
        verify(jdbc, times(2)).query(anyString(), any(RowMapper.class));
        assertThat(detail.variants()).allSatisfy(variant -> {
            assertThat(variant.options().get(0).value()).isEqualTo("Đen bóng");
            assertThat(variant.options().get(0).attributeValueId()).isNull();
        });

        // The next product mapping gets fresh vocabulary without a shared-cache expiry.
        jdbc.update("UPDATE catalog_visual_display_terms SET label_en = 'glossy' WHERE source_label = 'bóng'");
        clearInvocations(jdbc);
        var refreshed = repository.findProductBySlug("test-product", "en").orElseThrow();
        assertThat(refreshed.variants()).allSatisfy(variant ->
                assertThat(variant.options().get(0).accessibilityLabel()).isEqualTo("Black glossy"));
        verify(jdbc, times(2)).query(anyString(), any(RowMapper.class));
        clearInvocations(jdbc);

        var vietnamese = repository.findProductBySlug("test-product", "vi").orElseThrow();
        assertThat(vietnamese.variants()).allSatisfy(variant -> {
            assertThat(variant.options().get(0).accessibilityLabel()).isNull();
            assertThat(variant.options().get(0).value()).isEqualTo("Đen bóng");
        });
        repository.findProductBySlugForListing("test-product", "vi");
        org.mockito.Mockito.when(products.findById("test-product")).thenReturn(java.util.Optional.of(product));
        var admin = repository.findProductById("test-product").orElseThrow();
        assertThat(admin.variants()).allSatisfy(variant ->
                assertThat(variant.options().get(0).accessibilityLabel()).isNull());
        verify(jdbc, never()).query(anyString(), any(RowMapper.class));

        // English products with size options, no variants, or null variants need no vocabulary.
        attribute.setCode("size");
        var noColor = repository.findProductBySlug("test-product", "en").orElseThrow();
        assertThat(noColor.variants()).allSatisfy(variant ->
                assertThat(variant.options().get(0).accessibilityLabel()).isNull());
        repository.findProductBySlugForListing("test-product", "en");
        product.setVariants(List.of());
        assertThat(repository.findProductBySlug("test-product", "en").orElseThrow().variants()).isEmpty();
        product.setVariants(null);
        assertThat(repository.findProductBySlugForListing("test-product", "en").orElseThrow().variants()).isEmpty();
        verify(jdbc, never()).query(anyString(), any(RowMapper.class));
    }

}
