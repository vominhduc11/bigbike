package com.bigbike.bigbike_backend.repository.catalog;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class ProductSearchTermsTest {

    @Test
    @DisplayName("P4: free Vietnamese wording converges to meaningful AND-search tokens")
    void acceptanceWordingProducesStableCatalogTokens() {
        assertThat(ProductSearchTerms.tokens("tôi muốn tìm sản phẩm mũ tanami"))
                .containsExactly("mu", "tanami");
        assertThat(ProductSearchTerms.tokens("tôi muốn tìm sản phẩm tanami"))
                .containsExactly("tanami");
        assertThat(ProductSearchTerms.tokens("nón tanami giá bao nhiêu"))
                .containsExactly("mu", "tanami");
        assertThat(ProductSearchTerms.tokens("cho mình xem cái mũ tanami với"))
                .containsExactly("mu", "tanami");
        assertThat(ProductSearchTerms.tokens("shop có mũ Caberg Tanami không"))
                .containsExactly("mu", "caberg", "tanami");
        assertThat(ProductSearchTerms.tokens("mu tanami"))
                .containsExactly("mu", "tanami");
        assertThat(ProductSearchTerms.tokens("e muốn xem mũ tanami ạ"))
                .containsExactly("mu", "tanami");
        assertThat(ProductSearchTerms.tokens("mũ tanami carbon còn hàng ko"))
                .containsExactly("mu", "tanami", "carbon");
    }

    @Test
    @DisplayName("P4/CHAT_RULE_018: filler-only queries cannot become a whole-catalog scan")
    void fillerOnlyQueryProducesNoSearchTokens() {
        assertThat(ProductSearchTerms.tokens(
                "tôi muốn tìm sản phẩm cho mình xem với nhé shop có không ạ"))
                .isEmpty();
        assertThat(ProductSearchTerms.tokens(null)).isEqualTo(List.of());
    }

    @Test
    @DisplayName("product matching is limited to bilingual identifiers and SKU")
    void matchesOnlyProductIdentifiers() {
        assertThat(ProductSearchTerms.matchesProductIdentifiers(
                "Áo giáp Taichi RSJ354", null, "ao-giap-taichi-rsj354", null, "TAICHI-RSJ354",
                List.of("lot"))).isFalse();
        assertThat(ProductSearchTerms.matchesProductIdentifiers(
                "Đồ lót trùm đầu", null, "do-lot-trum-dau", null, "UNDERWEAR-001",
                List.of("lot"))).isTrue();
        assertThat(ProductSearchTerms.matchesProductIdentifiers(
                "Đồ bảo hộ", "Underwear Base Layer", "do-bao-ho", "underwear-base-layer", "BASE-001",
                List.of("underwear"))).isTrue();
        assertThat(ProductSearchTerms.matchesProductIdentifiers(
                "Mũ Xpeed IS-2V", null, "mu-xpeed-is-2v", null, "LOT-REAL-123",
                List.of("lot"))).isTrue();
        assertThat(ProductSearchTerms.matchesProductIdentifiers(
                "Mũ bảo hiểm", null, "mu-bao-hiem", null, "HELMET-001",
                List.of("mu", "bao", "hiem"))).isTrue();
        assertThat(ProductSearchTerms.matchesProductIdentifiers(
                "Mũ bảo hiểm", null, "mu-bao-hiem", null, "HELMET-001",
                List.of("mũ bảo hiểm"))).isTrue();
        assertThat(ProductSearchTerms.matchesProductIdentifiers(
                "Đồ lót trùm đầu", null, "do-lot-trum-dau", null, "UNDERWEAR-001",
                List.of("lót"))).isTrue();
    }
}
