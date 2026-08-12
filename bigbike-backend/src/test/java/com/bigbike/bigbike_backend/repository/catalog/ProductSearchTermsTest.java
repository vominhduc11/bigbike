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
}
