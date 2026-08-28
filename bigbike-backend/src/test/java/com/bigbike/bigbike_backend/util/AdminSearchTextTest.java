package com.bigbike.bigbike_backend.util;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class AdminSearchTextTest {

    @Test
    void foldsVietnameseAccentsAndCaseWithoutDroppingStaffWords() {
        assertThat(AdminSearchText.normalize("  NGUYỄN  Văn  ")).isEqualTo("nguyen van");
        assertThat(AdminSearchText.tokens("giá màu sản phẩm kỹ thuật"))
                .containsExactly("gia", "mau", "san", "pham", "ky", "thuat");
        assertThat(AdminSearchText.matchesAllTokens("nguyen", java.util.List.of("Nguyễn Văn A")))
                .isTrue();
    }

    @Test
    void treatsLikeWildcardsAsLiteralCharacters() {
        assertThat(AdminSearchText.escapeLike("100%_\\code"))
                .isEqualTo("100\\%\\_\\\\code");
        assertThat(AdminSearchText.likePattern("%"))
                .isEqualTo("%\\%%");
    }

    @Test
    void ranksExactThenPrefixThenContains() {
        assertThat(AdminSearchText.rank("mũ", java.util.List.of("Mũ"))).isZero();
        assertThat(AdminSearchText.rank("mũ", java.util.List.of("Mũ bảo hiểm"))).isEqualTo(1);
        assertThat(AdminSearchText.rank("mũ", java.util.List.of("Nón cho mũ"))).isEqualTo(2);
    }
}
