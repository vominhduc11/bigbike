package com.bigbike.bigbike_backend.service.catalog;

import static org.assertj.core.api.Assertions.assertThat;

import com.bigbike.bigbike_backend.domain.catalog.HomepageBlock;
import com.bigbike.bigbike_backend.domain.catalog.Product;
import com.bigbike.bigbike_backend.domain.catalog.ProductHighlights;
import com.bigbike.bigbike_backend.domain.catalog.ProductPrice;
import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.domain.catalog.ProductVariant;
import com.bigbike.bigbike_backend.domain.catalog.ProductVariantOption;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;

class CatalogVisualFacetCatalogTest {

    private final CatalogVisualFacetCatalog catalog = new CatalogVisualFacetCatalog(List.of(
            definition("COLOR", "den", Set.of("den", "den-nham", "den-do", "gloss-black", "carbon-3k-bong")),
            definition("COLOR", "do", Set.of("do", "den-do", "ronin-red")),
            definition("FINISH", "nham", Set.of("den-nham", "red-matte")),
            definition("FINISH", "bong", Set.of("gloss-black", "carbon-3k-bong")),
            definition("FINISH", "carbon", Set.of("carbon-3k-bong"))));

    @Test
    void compoundAliasBelongsToEveryRecognizedBaseColor() {
        Product product = product("compound", "Đen đỏ");

        assertThat(catalog.colorsFor(product)).containsExactlyInAnyOrder("den", "do");
        assertThat(catalog.matches(product, catalog.resolve(List.of("den"), List.of()))).isTrue();
        assertThat(catalog.matches(product, catalog.resolve(List.of("do"), List.of()))).isTrue();
    }

    @Test
    void legacyVariantUrlResolvesToCanonicalBaseColor() {
        CatalogVisualFacetCatalog.Selection selection = catalog.resolve(List.of("den-nham"), List.of());

        assertThat(selection.colors()).containsExactly("den");
        assertThat(catalog.matches(product("matte", "Đen nhám"), selection)).isTrue();
    }

    @Test
    void omittedNonColorAliasDoesNotCreateAFalseEmptyResult() {
        CatalogVisualFacetCatalog.Selection selection = catalog.resolve(List.of("soc"), List.of());

        assertThat(selection.colors()).isEmpty();
        assertThat(catalog.matches(product("plain", "Đen"), selection)).isTrue();
    }

    @Test
    void colorAndFinishMustMatchTheSameRawVisualOption() {
        Product split = product("split", "Gloss Black", "Red matte");

        assertThat(catalog.matches(split, catalog.resolve(List.of("den"), List.of("nham")))).isFalse();
        assertThat(catalog.matches(split, catalog.resolve(List.of("den"), List.of("bong")))).isTrue();
    }

    @Test
    void carbonPaintKeepsItsBlackBaseColorAndSeparateFinish() {
        Product carbon = product("carbon", "Carbon 3K bóng");

        assertThat(catalog.colorsFor(carbon)).containsExactly("den");
        assertThat(catalog.finishesFor(carbon)).containsExactlyInAnyOrder("bong", "carbon");
        assertThat(catalog.matches(carbon, catalog.resolve(List.of("den"), List.of("carbon")))).isTrue();
    }

    @Test
    void groupedCountUsesUniqueProductsInsteadOfRawAliasCount() {
        List<Product> products = List.of(
                product("one", "Đen", "Đen nhám"),
                product("two", "Đen đỏ"),
                product("three", "Ronin Red"));

        long black = products.stream().filter(product -> catalog.colorsFor(product).contains("den")).count();
        long red = products.stream().filter(product -> catalog.colorsFor(product).contains("do")).count();

        assertThat(black).isEqualTo(2);
        assertThat(red).isEqualTo(2);
    }

    private static CatalogVisualFacetCatalog.Definition definition(String type, String key, Set<String> aliases) {
        return new CatalogVisualFacetCatalog.Definition(type, key, key, key, null, 1, aliases);
    }

    private static Product product(String id, String... colors) {
        List<ProductVariant> variants = java.util.Arrays.stream(colors)
                .map(color -> new ProductVariant(
                        id + "-" + CatalogReadSupport.colorBaseSlug(color), null, color,
                        List.of(new ProductVariantOption("Màu sắc", color)), null,
                        ProductStockState.IN_STOCK, null, List.of(), true))
                .toList();
        return new Product(
                "product-" + id, "SKU-" + id, id, null, id, null, null, null, null,
                List.of(), null, List.of(), List.of(),
                new ProductPrice(BigDecimal.valueOf(1_000_000), null, "VND"), variants,
                ProductStockState.IN_STOCK, Boolean.TRUE, PublishStatus.PUBLISHED, false,
                null, HomepageBlock.NONE, null, null, null, List.of(), List.of(),
                ProductHighlights.EMPTY, null, null, null, null, null, null, null, null,
                List.of(), List.of(), null, null, null, null, null, Instant.now(), Instant.now());
    }
}
