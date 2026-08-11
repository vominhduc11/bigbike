package com.bigbike.bigbike_backend.service.chat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockingDetails;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.api.chat.dto.ChatContactResponse;
import com.bigbike.bigbike_backend.domain.catalog.Brand;
import com.bigbike.bigbike_backend.domain.catalog.Category;
import com.bigbike.bigbike_backend.service.catalog.CatalogReadService;
import com.bigbike.bigbike_backend.service.common.PageResult;
import com.bigbike.bigbike_backend.service.order.OrderReadService;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.invocation.Invocation;

/**
 * Locks in how Bi turns a customer sentence into catalogue filters
 * (CHAT_RULE_015 price direction, CHAT_RULE_016 ordering, CHAT_RULE_017 category/brand,
 * CHAT_RULE_018 no silent whole-catalogue sweep).
 */
class BiSearchDecisionTest {

    private static final ChatAssistantSettings.Snapshot SETTINGS = new ChatAssistantSettings.Snapshot(
            true, 60, "Xin chào", List.of("A", "B", "C"),
            new ChatContactResponse("0900", "", "", "", ""), "", "", "");

    @Test
    @DisplayName("CHAT_RULE_015: a floor price is never turned into a ceiling")
    void floorQuestionsSearchAboveTheAmount() {
        assertThat(firstSearch("tìm sản phẩm từ 5 triệu"))
                .returns(5_000_000L, Search::minPrice)
                .returns(null, Search::maxPrice);
        assertThat(firstSearch("có mũ nào trên 5 triệu không"))
                .returns("mu-bao-hiem", Search::category)
                .returns(5_000_000L, Search::minPrice)
                .returns(null, Search::maxPrice);
        assertThat(firstSearch("áo giáp 5 triệu trở lên"))
                .returns(5_000_000L, Search::minPrice)
                .returns(null, Search::maxPrice);
    }

    @Test
    @DisplayName("CHAT_RULE_015: ceilings, ranges and approximations keep their own shape")
    void otherPriceShapesKeepTheirMeaning() {
        assertThat(firstSearch("tìm mũ fullface dưới 3 triệu"))
                .returns("mu-bao-hiem-fullface", Search::category)
                .returns(null, Search::minPrice)
                .returns(3_000_000L, Search::maxPrice);
        assertThat(firstSearch("mũ bảo hiểm từ 3 đến 5 triệu"))
                .returns(3_000_000L, Search::minPrice)
                .returns(5_000_000L, Search::maxPrice);
        assertThat(firstSearch("mũ 3/4 tầm 2 triệu"))
                .returns("mu-bao-hiem-3-4", Search::category)
                .returns(1_400_000L, Search::minPrice)
                .returns(2_400_000L, Search::maxPrice);
    }

    @Test
    @DisplayName("CHAT_RULE_017: an unaccented customer lands on the same category")
    void unaccentedQuestionsResolveTheSameWay() {
        Search accented = firstSearch("tìm mũ fullface dưới 3 triệu");
        Search plain = firstSearch("tim mu fullface duoi 3 trieu");
        assertThat(plain.category()).isEqualTo(accented.category());
        assertThat(plain.maxPrice()).isEqualTo(accented.maxPrice());
        assertThat(firstSearch("gang tay duoi 500k").category()).isEqualTo("gang-tay-xe-may-moto");
        assertThat(firstSearch("mu ls2 fullface"))
                .returns("mu-bao-hiem-fullface", Search::category)
                .returns("ls2", Search::brand);
        assertThat(firstSearch("sản phẩm LS2"))
                .returns(null, Search::category)
                .returns("ls2", Search::brand);
        assertThat(firstSearch("san pham ls2"))
                .returns(null, Search::category)
                .returns("ls2", Search::brand);
    }

    @Test
    @DisplayName("CHAT_RULE_017: the more specific wording wins over the generic one")
    void mostSpecificCategoryWins() {
        assertThat(firstSearch("áo mưa").category()).isEqualTo("ao-mua-do-di-mua-moto");
        assertThat(firstSearch("áo mùa hè").category()).isEqualTo("ao-quan-moto-mua-he");
        assertThat(firstSearch("mũ lật hàm").category()).isEqualTo("mu-bao-hiem-lat-ham-thao-ham");
        assertThat(firstSearch("tai nghe bluetooth cho mũ").category())
                .isEqualTo("tai-nghe-bluetooth-mu-bao-hiem");
    }

    @Test
    @DisplayName("CHAT_RULE_016: ordering follows the request, never 'cheapest first' by default")
    void sortFollowsTheRequest() {
        assertThat(firstSearch("áo giáp cao cấp nhất shop").sort()).isEqualTo("price:desc");
        assertThat(firstSearch("mũ bảo hiểm rẻ nhất").sort()).isEqualTo("price:asc");
        assertThat(firstSearch("balo đi phượt").sort()).isEqualTo("createdAt:desc");
        assertThat(firstSearch("mũ LS2 giá bao nhiêu").sort()).isEqualTo("createdAt:desc");
    }

    @Test
    @DisplayName("CHAT_RULE_018: a named category is never abandoned for a whole-catalogue sweep")
    void namedCategorySurvivesEveryFallback() {
        for (String question : List.of(
                "tim mu fullface duoi 3 trieu", "gang tay duoi 500k", "áo giáp 5 triệu trở lên")) {
            List<Search> ladder = allSearches(question);
            assertThat(ladder).as(question).isNotEmpty();
            assertThat(ladder).as(question).allSatisfy(search ->
                    assertThat(search.category() != null || search.brand() != null || search.query() != null)
                            .as("%s -> %s", question, search)
                            .isTrue());
        }
    }

    @Test
    @DisplayName("CHAT_RULE_017: conversational wording keeps only model/name identifiers")
    void productDiscoveryNormalizesNaturalLanguageWithoutDroppingIdentifiers() {
        for (String question : List.of(
                "tôi muốn tìm sản phẩm mũ tanami",
                "Tôi muốn tìm mũ bảo hiểm Tanami",
                "mũ tanami",
                "TANAMI, mũ!!!",
                "mũ   tanami")) {
            ChatToolService.ProductQuery query = ChatToolService.extractProductQuery(question);
            assertThat(query.identifiers()).as(question).containsExactly("tanami");
        }

        for (String question : List.of(
                "Caberg Tanami Carbon",
                "Mũ bảo hiểm dual sport Caberg Tanami Carbon",
                "Carbon — Tanami / Caberg")) {
            ChatToolService.ProductQuery query = ChatToolService.extractProductQuery(question);
            assertThat(query.identifiers()).as(question).containsExactlyInAnyOrder("tanami", "carbon");
        }
    }

    @Test
    @DisplayName("CHAT_RULE_017: variant inquiry words are not AGV model identifiers")
    void variantInquiryKeepsOnlyTheModelIdentifier() {
        for (String question : List.of(
                "Mũ AGV K3 có size và màu nào?",
                "mu agv k3 co size va mau nao?")) {
            ChatToolService.ProductQuery query = ChatToolService.extractProductQuery(question);

            assertThat(query.text()).as(question).isEqualTo("mu agv k3");
            assertThat(query.identifiers()).as(question).containsExactly("k3");
        }
    }

    @Test
    @DisplayName("budget framing without an amount is a local clarification, not a search")
    void budgetFramingAsksForTheMissingPriceRange() {
        CatalogReadService catalog = mock(CatalogReadService.class);
        ChatToolService tools = new ChatToolService(catalog, mock(OrderReadService.class));
        for (String question : List.of(
                "Tìm mũ bảo hiểm theo ngân sách",
                "Tim mu bao hiem theo ngan sach")) {
            ChatToolService.ToolOutcome outcome = tools.resolve(question, "vi", null, SETTINGS);
            assertThat(outcome.aiRequired()).as(question).isFalse();
            assertThat(outcome.localAnswer()).as(question).contains("tầm giá nào");
        }
        assertThat(mockingDetails(catalog).getInvocations()).isEmpty();
    }

    @Test
    @DisplayName("CHAT_RULE_017/018: a named product miss never falls back to a generic category search")
    void namedProductSearchUsesIdentifierTokensOnly() {
        CatalogReadService catalog = mock(CatalogReadService.class);
        when(catalog.searchProductsForAssistant(any(), any(), any(), any(), any(), any(), anyInt(), any()))
                .thenReturn(List.of());

        new ChatToolService(catalog, mock(OrderReadService.class)).resolve(
                "tôi muốn tìm sản phẩm mũ tanami", "vi", null, SETTINGS);

        Invocation search = mockingDetails(catalog).getInvocations().stream()
                .filter(call -> "searchProductsForAssistant".equals(call.getMethod().getName()))
                .findFirst()
                .orElseThrow();
        assertThat(search.getMethod().getName()).isEqualTo("searchProductsForAssistant");
        Object[] arguments = search.getArguments();
        assertThat(arguments[0]).isEqualTo(List.of("tanami"));
        assertThat(arguments[1]).isEqualTo("mu-bao-hiem");
        assertThat(arguments[2]).isNull();
    }

    @Test
    @DisplayName("CHAT_RULE_017: a public brand added to the catalog works without a chat hard-code")
    void resolvesBrandFromPublicCatalogVocabulary() {
        CatalogReadService catalog = mock(CatalogReadService.class);
        when(catalog.listAssistantBrands()).thenReturn(List.of(brand("roadfox", "RoadFox")));
        when(catalog.listProducts(anyInt(), anyInt(), any(), any(), any(), any(), any(), any(),
                any(), any(), any(), any()))
                .thenReturn(new PageResult<>(List.of(), 1, 10, 0, 0));

        new ChatToolService(catalog, mock(OrderReadService.class))
                .resolve("Tìm sản phẩm thương hiệu ROADFOX", "vi", null, SETTINGS);

        Invocation search = mockingDetails(catalog).getInvocations().stream()
                .filter(call -> "listProducts".equals(call.getMethod().getName()))
                .findFirst()
                .orElseThrow();
        assertThat(search.getArguments()[4]).isEqualTo("roadfox");
        assertThat(search.getArguments()[5]).isNull();
    }

    @Test
    @DisplayName("CHAT_RULE_017: a public category added to the catalog works without a chat hard-code")
    void resolvesCategoryFromPublicCatalogVocabulary() {
        CatalogReadService catalog = mock(CatalogReadService.class);
        when(catalog.listAssistantCategories(any())).thenReturn(List.of(category("neck-guard", "Neck Guard")));
        when(catalog.listProducts(anyInt(), anyInt(), any(), any(), any(), any(), any(), any(),
                any(), any(), any(), any()))
                .thenReturn(new PageResult<>(List.of(), 1, 10, 0, 0));

        new ChatToolService(catalog, mock(OrderReadService.class))
                .resolve("Find neck guard", "en", null, SETTINGS);

        Invocation search = mockingDetails(catalog).getInvocations().stream()
                .filter(call -> "listProducts".equals(call.getMethod().getName()))
                .findFirst()
                .orElseThrow();
        assertThat(search.getArguments()[3]).isEqualTo("neck-guard");
        assertThat(search.getArguments()[5]).isNull();
    }

    private static Search firstSearch(String question) {
        return allSearches(question).get(0);
    }

    private static List<Search> allSearches(String question) {
        CatalogReadService catalog = mock(CatalogReadService.class);
        when(catalog.listAssistantBrands()).thenReturn(List.of(brand("ls2", "LS2")));
        when(catalog.listProducts(anyInt(), anyInt(), any(), any(), any(), any(), any(), any(),
                any(), any(), any(), any()))
                .thenReturn(new PageResult<>(List.of(), 1, 10, 0, 0));
        new ChatToolService(catalog, mock(OrderReadService.class))
                .resolve(question, "vi", null, SETTINGS);

        return mockingDetails(catalog).getInvocations().stream()
                .filter(invocation -> "listProducts".equals(invocation.getMethod().getName()))
                .map(invocation -> {
                    Object[] a = invocation.getArguments();
                    return new Search((String) a[3], (String) a[4], (String) a[5],
                            (Long) a[8], (Long) a[9], (String) a[2]);
                })
                .toList();
    }

    private static Brand brand(String slug, String name) {
        return new Brand(slug, slug, name, null, null, null, null, null,
                true, false, null, null, null);
    }

    private static Category category(String slug, String name) {
        return new Category(slug, slug, null, name, null, null, null, null, null,
                null, null, null, true, false, null, null, null, null, null, null);
    }

    private record Search(
            String category, String brand, String query, Long minPrice, Long maxPrice, String sort) {}
}
