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
import com.bigbike.bigbike_backend.domain.catalog.SizeScale;
import com.bigbike.bigbike_backend.domain.catalog.SizeScaleGroup;
import com.bigbike.bigbike_backend.domain.catalog.SizeScaleValue;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;

class SizeScaleCatalogTest {

    private static final SizeScaleGroup CLOTHING = new SizeScaleGroup(
            "clothing-letter", "Cỡ đồ mặc (chữ)", "Apparel letter sizes", 10, true);
    private static final SizeScaleGroup SHOES = new SizeScaleGroup(
            "shoe", "Cỡ giày", "Shoe sizes", 20, true);
    private static final SizeScaleGroup PANTS_WAIST = new SizeScaleGroup(
            "pants-waist", "Cỡ quần (eo inch)", "Pants (waist inch)", 30, true);
    private static final SizeScaleGroup PANTS_EU = new SizeScaleGroup(
            "pants-eu", "Cỡ quần (EU)", "Pants (EU)", 40, true);

    @Test
    void groupsValuesInConfiguredOrderAndKeepsNumericNamespacesSeparate() {
        SizeScale clothing = scale(
                "apparel", "clothing-letter", CLOTHING, 10,
                value("M", 30), value("XXL", 60));
        SizeScale shoes = scale(
                "shoe", "shoe", SHOES, 20,
                value("42", 70));
        SizeScale waist = scale(
                "waist", "pants-waist", PANTS_WAIST, 30,
                value("42", 80));
        SizeScale eu = scale(
                "apparel-eu", "pants-eu", PANTS_EU, 40,
                value("44", 90));
        SizeScaleCatalog catalog = new SizeScaleCatalog(List.of(clothing, shoes, waist, eu));

        List<com.bigbike.bigbike_backend.domain.catalog.CatalogFacets.SizeGroupFacet> groups =
                CatalogReadSupport.buildSizeGroups(List.of(
                        product("shirt", "apparel", variant("M"), variant("2XL")),
                        product("shoe", "shoe", variant("42")),
                        product("pants", "waist", variant("42")),
                        product("pants-eu", "apparel-eu", variant("44"))), catalog, "vi");

        assertThat(groups).extracting("key")
                .containsExactly("clothing-letter", "shoe", "pants-waist", "pants-eu");
        assertThat(groups.get(0).buckets()).extracting("key", "label")
                .containsExactly(
                        org.assertj.core.groups.Tuple.tuple("clothing-letter:M", "M"),
                        org.assertj.core.groups.Tuple.tuple("clothing-letter:XXL", "XXL"));
        assertThat(groups.get(1).buckets()).extracting("key", "count")
                .containsExactly(org.assertj.core.groups.Tuple.tuple("shoe:42", 1L));
        assertThat(groups.get(2).buckets()).extracting("key", "count")
                .containsExactly(org.assertj.core.groups.Tuple.tuple("pants-waist:42", 1L));
        assertThat(groups.get(3).buckets()).extracting("key", "count")
                .containsExactly(org.assertj.core.groups.Tuple.tuple("pants-eu:44", 1L));
    }

    @Test
    void canonicalizesDuplicateLetterSpellingsAndMatchesOnlyTheSelectedNamespace() {
        SizeScale clothing = scale(
                "apparel", "clothing-letter", CLOTHING, 10,
                value("XXL", 60));
        SizeScale shoes = scale("shoe", "shoe", SHOES, 20, value("42", 70));
        SizeScale waist = scale("waist", "pants-waist", PANTS_WAIST, 30, value("42", 80));
        SizeScaleCatalog catalog = new SizeScaleCatalog(List.of(clothing, shoes, waist));

        Product shoe = product("shoe", "shoe", variant("42"));
        Product shirt = product("shirt", "apparel", variant("2XL"), variant("XXL"));

        assertThat(catalog.matches(shoe, List.of("shoe:42"))).isTrue();
        assertThat(catalog.matches(shoe, List.of("pants-waist:42"))).isFalse();
        assertThat(catalog.resolve(shirt)).extracting(SizeScaleCatalog.ResolvedSize::token)
                .containsExactly("clothing-letter:XXL");
    }

    @Test
    void flattensLegacySubgroupsIntoTheConfiguredGroup() {
        SizeScale apparel = scale(
                "apparel", "clothing-letter", CLOTHING, 10,
                value("M", 30),
                new SizeScaleValue("WS", "WS", "WS", "women", "Nữ", "Women", 110, true),
                new SizeScaleValue("BM", "BM", "BM", "big-size", "Big size", "Big size", 210, true));
        SizeScaleCatalog catalog = new SizeScaleCatalog(List.of(apparel));

        var group = CatalogReadSupport.buildSizeGroups(List.of(
                product("shirt", "apparel", variant("M"), variant("WS"), variant("BM"))), catalog, "vi").get(0);

        assertThat(group.buckets()).extracting("key")
                .containsExactly("clothing-letter:M", "clothing-letter:WS", "clothing-letter:BM");
    }

    private static SizeScale scale(
            String id,
            String namespace,
            SizeScaleGroup group,
            int sortOrder,
            SizeScaleValue... values) {
        return new SizeScale(id, id, id, id, group, namespace, sortOrder, true, List.of(values));
    }

    private static SizeScaleValue value(String key, int sortOrder) {
        return new SizeScaleValue(key, key, key, null, null, null, sortOrder, true);
    }

    private static ProductVariant variant(String size) {
        return new ProductVariant(
                "variant-" + size,
                "SKU-" + size,
                size,
                List.of(new ProductVariantOption("Size", size)),
                null,
                ProductStockState.IN_STOCK,
                null,
                List.of(),
                true);
    }

    private static Product product(String id, String sizeScaleId, ProductVariant... variants) {
        return new Product(
                "product-" + id,
                "SKU-" + id,
                id,
                null,
                id,
                null,
                null,
                null,
                null,
                List.of(),
                null,
                List.of(),
                List.of(),
                new ProductPrice(BigDecimal.valueOf(1_000_000), null, "VND"),
                List.of(variants),
                ProductStockState.IN_STOCK,
                Boolean.TRUE,
                PublishStatus.PUBLISHED,
                false,
                sizeScaleId,
                HomepageBlock.NONE,
                null,
                null,
                null,
                List.of(),
                List.of(),
                ProductHighlights.EMPTY,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                List.of(),
                List.of(),
                null,
                null,
                null,
                null,
                null,
                Instant.now(),
                Instant.now());
    }
}
