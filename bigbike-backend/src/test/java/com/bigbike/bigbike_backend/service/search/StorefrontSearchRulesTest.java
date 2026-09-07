package com.bigbike.bigbike_backend.service.search;

import static org.assertj.core.api.Assertions.assertThat;

import com.bigbike.bigbike_backend.domain.catalog.BrandSummary;
import com.bigbike.bigbike_backend.domain.catalog.CategorySummary;
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
import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.Test;

/** Acceptance coverage for SEARCH_RULE_001–SEARCH_RULE_004. */
class StorefrontSearchRulesTest {

    @Test
    void groupA_keepsCustomerTerms_usesWordBoundaries_andRanksRelevantHelmetFirst() {
        Product prefix = product("helmet-prefix", "Mũ Bảo Hiểm Road", "road", "AGV", helmets(),
                ProductStockState.IN_STOCK, Instant.parse("2026-08-10T00:00:00Z"), List.of());
        Product middle = product("helmet-middle", "Fullface Mũ Bảo Hiểm", "fullface", "AGV", helmets(),
                ProductStockState.IN_STOCK, Instant.parse("2026-08-20T00:00:00Z"), List.of());
        Product categoryPhrase = product("helmet-category", "Touring Pro", "touring-pro", "AGV", helmets(),
                ProductStockState.IN_STOCK, Instant.parse("2026-08-22T00:00:00Z"), List.of());
        Product separateWords = product("helmet-words", "Mũ Carbon Bảo", "mu-carbon-bao", "AGV", categories("Phụ kiện"),
                ProductStockState.IN_STOCK, Instant.parse("2026-08-25T00:00:00Z"), List.of());
        Product rainGear = product("rain", "Đồ đi mưa bảo hộ", "do-di-mua", "Rain", categories("Áo mưa"),
                ProductStockState.IN_STOCK, Instant.parse("2026-08-28T00:00:00Z"), List.of());
        Product jacket = product("jacket", "Áo khoác touring", "ao-khoac", "Taichi", categories("Áo giáp"),
                ProductStockState.IN_STOCK, Instant.parse("2026-08-28T00:00:00Z"), List.of());

        assertThat(StorefrontSearchRules.productTerms("mũ bảo da màu giá"))
                .containsExactly("mu", "bao", "da", "mau", "gia");
        assertThat(StorefrontSearchRules.rankMatchingProducts(
                List.of(rainGear, separateWords, categoryPhrase, middle, prefix), "mũ bảo", 10))
                .extracting(Product::id)
                .containsExactly("helmet-prefix", "helmet-middle", "helmet-category", "helmet-words");
        // SEARCH_RULE_002 (2026-09-07): the trailing word is the word being typed, so it matches by
        // prefix — "khoa" therefore also reaches "khoác". The guarantee is on ORDER, not exclusion:
        // a product that matches the whole word outranks one that only matches the prefix.
        Product lock = product("lock", "Khóa đĩa chống trộm", "khoa-dia", "Rider", categories("Phụ kiện"),
                ProductStockState.IN_STOCK, Instant.parse("2026-08-01T00:00:00Z"), List.of());
        assertThat(StorefrontSearchRules.rankMatchingProducts(List.of(jacket, lock), "khóa", 10))
                .extracting(Product::id)
                .containsExactly("lock", "jacket");

        Product summer = product("summer", "Mùa hè thoáng khí", "mua-he", "Summer", categories("Phụ kiện"),
                ProductStockState.IN_STOCK, Instant.parse("2026-08-02T00:00:00Z"), List.of());
        assertThat(StorefrontSearchRules.rankMatchingProducts(List.of(summer, prefix), "mũ", 10))
                .extracting(Product::id)
                .containsExactly("helmet-prefix", "summer");

        Product leatherGlove = product("leather-glove", "Găng tay da cổ ngắn", "gang-tay-da", "Rider", categories("Găng tay"),
                ProductStockState.IN_STOCK, Instant.parse("2026-08-29T00:00:00Z"), List.of());
        Product textileGlove = product("textile-glove", "Găng tay vải", "gang-tay-vai", "Rider", categories("Găng tay"),
                ProductStockState.IN_STOCK, Instant.parse("2026-08-30T00:00:00Z"), List.of());
        assertThat(StorefrontSearchRules.rankMatchingProducts(
                List.of(textileGlove, leatherGlove), "găng tay da", 10))
                .extracting(Product::id)
                .startsWith("leather-glove");

        assertThat(StorefrontSearchRules.matchesProduct(prefix, "mũ bảo hiểm giá rẻ")).isTrue();
        assertThat(StorefrontSearchRules.matchesProduct(prefix, "sản phẩm")).isTrue();
        assertThat(StorefrontSearchRules.matchesProduct(prefix, "hàng mới")).isTrue();
        assertThat(StorefrontSearchRules.matchesProduct(prefix, "nón bảo")).isTrue();
    }

    @Test
    void groupB_searchesBrandCategoryAndVariantOptionData() {
        Product sockCategory = product("sock", "Phụ kiện touring", "phu-kien-touring", "Rider", categories("VỚ - ỐNG TAY"),
                ProductStockState.IN_STOCK, Instant.parse("2026-08-15T00:00:00Z"), List.of());
        Product pinlockCategory = product("pinlock", "Kính thay thế", "kinh-thay", "Rider", categories("KÍNH THAY - PINLOCK CHỐNG SƯƠNG"),
                ProductStockState.IN_STOCK, Instant.parse("2026-08-16T00:00:00Z"), List.of());
        Product brandOnly = product("brand", "Áo đi phố", "ao-di-pho", "KYT", categories("Áo giáp"),
                ProductStockState.IN_STOCK, Instant.parse("2026-08-17T00:00:00Z"), List.of());
        Product colorVariant = product("black-helmet", "Mũ touring", "mu-touring", "KYT", helmets(),
                ProductStockState.IN_STOCK, Instant.parse("2026-08-18T00:00:00Z"), List.of(
                        new ProductVariant("variant-black", "KYT-BLACK", "Đen", List.of(
                                new ProductVariantOption("Màu", "Đen")), null,
                                ProductStockState.IN_STOCK, null, List.of(), true)));

        assertThat(StorefrontSearchRules.matchesProduct(sockCategory, "vớ")).isTrue();
        assertThat(StorefrontSearchRules.matchesProduct(pinlockCategory, "pinlock")).isTrue();
        assertThat(StorefrontSearchRules.matchesProduct(brandOnly, "KYT")).isTrue();
        assertThat(StorefrontSearchRules.matchesProduct(colorVariant, "mũ màu đen")).isTrue();
    }

    @Test
    void groupC_articleTermsAreAccentInsensitiveAndWildcardCharactersStayLiteral() {
        assertThat(StorefrontSearchRules.matchesLiteralTerms(
                Arrays.asList("Hướng dẫn chọn Mũ Bảo Hiểm", "Kinh nghiệm thực tế"),
                StorefrontSearchRules.literalTerms("mu bao hiem"))).isTrue();
        assertThat(StorefrontSearchRules.matchesLiteralTerms(
                Arrays.asList("Giảm 50% cho mũ bảo hiểm", null),
                StorefrontSearchRules.literalTerms("50%"))).isTrue();
        assertThat(StorefrontSearchRules.matchesLiteralTerms(
                Arrays.asList("Bài viết bình thường", "không có ký tự đặc biệt"),
                StorefrontSearchRules.literalTerms("%"))).isFalse();
        assertThat(StorefrontSearchRules.literalLikePattern("50%_\\"))
                .isEqualTo("%50\\%\\_\\\\%");
    }

    @Test
    void groupD_partialWordKeepsNarrowing_andNeverCollapsesToEmpty() {
        Product komineKnee = product("komine-knee", "Giáp gối moto Komine SK-684", "giap-goi-komine",
                "KOMINE", categories("Giáp bảo hộ"), ProductStockState.IN_STOCK,
                Instant.parse("2026-08-10T00:00:00Z"), List.of());
        Product ls2Helmet = product("ls2-helmet", "Mũ bảo hiểm LS2 Storm", "mu-ls2-storm", "LS2",
                helmets(), ProductStockState.IN_STOCK, Instant.parse("2026-08-11T00:00:00Z"), List.of());
        List<Product> catalog = List.of(komineKnee, ls2Helmet);

        // The reported bug: "komi"/"komin" used to return nothing between "kom" and "komine".
        for (String typed : List.of("k", "ko", "kom", "komi", "komin", "komine")) {
            assertThat(StorefrontSearchRules.matchesProduct(komineKnee, typed))
                    .as("typing %s must still reach the Komine product", typed)
                    .isTrue();
        }
        assertThat(StorefrontSearchRules.matchesProduct(ls2Helmet, "ls")).isTrue();
        assertThat(StorefrontSearchRules.matchesProduct(ls2Helmet, "ls2")).isTrue();

        // Each extra character may only shrink the result set, never grow it.
        List<String> keystrokes = List.of("k", "ko", "kom", "komi", "komin", "komine");
        for (int index = 1; index < keystrokes.size(); index++) {
            List<String> wider = ids(catalog, keystrokes.get(index - 1));
            List<String> narrower = ids(catalog, keystrokes.get(index));
            assertThat(wider)
                    .as("results for %s must contain results for %s", keystrokes.get(index - 1), keystrokes.get(index))
                    .containsAll(narrower);
        }
    }

    @Test
    void groupE_sizeOptionsAreOutOfScopeWhileColourStaysSearchable() {
        Product sizedJacket = product("sized-jacket", "Áo giáp touring", "ao-giap-touring", "Taichi",
                categories("Áo giáp"), ProductStockState.IN_STOCK, Instant.parse("2026-08-12T00:00:00Z"),
                List.of(new ProductVariant("variant-m", "TAICHI-M", "M", List.of(
                        new ProductVariantOption("Kích cỡ", "M"),
                        new ProductVariantOption("Màu sắc", "Đen")), null,
                        ProductStockState.IN_STOCK, null, List.of(), true)));

        // Owner decision 2026-09-07: a size never makes a product match, a colour still does.
        assertThat(StorefrontSearchRules.matchesProduct(sizedJacket, "m")).isFalse();
        assertThat(StorefrontSearchRules.matchesProduct(sizedJacket, "l")).isFalse();
        assertThat(StorefrontSearchRules.matchesProduct(sizedJacket, "s")).isFalse();
        assertThat(StorefrontSearchRules.matchesProduct(sizedJacket, "đen")).isTrue();
        // Option LABELS are never searchable either — they would match the whole catalogue.
        assertThat(StorefrontSearchRules.matchesProduct(sizedJacket, "kích cỡ")).isFalse();
        assertThat(StorefrontSearchRules.matchesProduct(sizedJacket, "màu sắc")).isFalse();
        // A single in-progress letter must not reach the synthetic product markers either.
        assertThat(StorefrontSearchRules.matchesProduct(sizedJacket, "s")).isFalse();
        assertThat(StorefrontSearchRules.matchesProduct(sizedJacket, "sản phẩm")).isTrue();
    }

    @Test
    void groupF_brandPrefixOutranksLooseMatchesForVeryShortQueries() {
        Product komine = product("komine", "Găng tay mùa hè", "gang-tay-mua-he", "KOMINE",
                categories("Găng tay"), ProductStockState.IN_STOCK, Instant.parse("2026-08-13T00:00:00Z"), List.of());
        Product kneeGuard = product("knee", "Giáp gối Rider", "giap-goi-rider", "Rider",
                categories("Khác"), ProductStockState.IN_STOCK, Instant.parse("2026-08-14T00:00:00Z"),
                List.of(new ProductVariant("variant-k", "RIDER-K1", "K1", List.of(), null,
                        ProductStockState.IN_STOCK, null, List.of(), true)));

        assertThat(StorefrontSearchRules.rankMatchingProducts(List.of(kneeGuard, komine), "k", 10))
                .extracting(Product::id)
                .startsWith("komine");
    }

    @Test
    void groupG_articlesFollowTheSameWordRuleAsProducts() {
        List<String> article = Arrays.asList("Hướng dẫn chọn mũ bảo hiểm", "Kinh nghiệm cho người mới");

        // Articles used to match a fragment ANYWHERE, including inside a word, which is why a bare
        // "k" hit 68 of 174 articles while products returned 0. Now they match at word boundaries
        // exactly like products do.
        assertThat(StorefrontSearchRules.matchesLiteralTerms(article,
                StorefrontSearchRules.literalTerms("iem"))).isFalse();
        assertThat(StorefrontSearchRules.matchesLiteralTerms(article,
                StorefrontSearchRules.literalTerms("ghiem"))).isFalse();
        // A word start still matches, the same way "k" reaches a Komine product.
        assertThat(StorefrontSearchRules.matchesLiteralTerms(article,
                StorefrontSearchRules.literalTerms("k"))).isTrue();
        assertThat(StorefrontSearchRules.matchesLiteralTerms(article,
                StorefrontSearchRules.literalTerms("kinh"))).isTrue();
        // Trailing word still matches by prefix, so typing never blanks the list.
        assertThat(StorefrontSearchRules.matchesLiteralTerms(article,
                StorefrontSearchRules.literalTerms("mu bao hi"))).isTrue();
        // A leading term must be a complete word.
        assertThat(StorefrontSearchRules.matchesLiteralTerms(article,
                StorefrontSearchRules.literalTerms("hi bao"))).isFalse();
    }

    private static List<String> ids(List<Product> catalog, String query) {
        return StorefrontSearchRules.rankMatchingProducts(catalog, query, 50)
                .stream().map(Product::id).toList();
    }

    private static List<CategorySummary> helmets() {
        return categories("Mũ bảo hiểm");
    }

    private static List<CategorySummary> categories(String name) {
        String slug = StorefrontSearchRules.productTerms(name).stream().reduce((left, right) -> left + "-" + right)
                .orElse("category");
        return List.of(new CategorySummary("category-" + slug, slug, null, name, true, false));
    }

    private static Product product(
            String id,
            String name,
            String slug,
            String brandName,
            List<CategorySummary> categories,
            ProductStockState stockState,
            Instant createdAt,
            List<ProductVariant> variants
    ) {
        BrandSummary brand = new BrandSummary("brand-" + brandName, brandName.toLowerCase(), brandName);
        return new Product(
                id, "SKU-" + id, slug, null, name, null, null, brand,
                categories.isEmpty() ? null : categories.get(0), categories,
                null, List.of(), List.of(), new ProductPrice(BigDecimal.valueOf(1_000_000), null, "VND"), variants,
                stockState, stockState == ProductStockState.IN_STOCK, PublishStatus.PUBLISHED, false,
                null, HomepageBlock.NONE, null, null, null, List.of(), List.of(),
                ProductHighlights.EMPTY, null, null, null, null, null, null, null, null,
                List.of(), List.of(), null, null, null, null, null, createdAt, createdAt);
    }
}
