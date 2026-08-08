package com.bigbike.bigbike_backend.service.review;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/** Local banned-word layer (REVIEW_RULE_013). */
class ReviewBannedWordMatcherTest {

    private static ReviewBannedWordMatcher matcher(String settingValue) {
        return ReviewBannedWordMatcher.fromSettingValue(settingValue);
    }

    @Test
    @DisplayName("empty or blank settings match nothing")
    void emptyListMatchesNothing() {
        assertThat(matcher(null).isEmpty()).isTrue();
        assertThat(matcher("   ").isEmpty()).isTrue();
        assertThat(matcher("").firstMatch("bất kỳ nội dung nào")).isEmpty();
    }

    @Test
    @DisplayName("terms may be separated by commas or new lines")
    void acceptsBothSeparators() {
        ReviewBannedWordMatcher commas = matcher("abcxyz, twoword");
        ReviewBannedWordMatcher newlines = matcher("abcxyz\ntwoword");

        assertThat(commas.firstMatch("nội dung abcxyz ở đây")).contains("abcxyz");
        assertThat(newlines.firstMatch("nội dung abcxyz ở đây")).contains("abcxyz");
    }

    @ParameterizedTest(name = "evasion \"{0}\" still matches")
    @ValueSource(strings = {"dm", "đm", "đ.m", "d-m", "D.M", "Đ-M"})
    @DisplayName("diacritics, case and inserted punctuation do not defeat a term")
    void normalisesEvasions(String evasion) {
        assertThat(matcher("dm").firstMatch("sản phẩm " + evasion + " tệ")).contains("dm");
    }

    @Test
    @DisplayName("a term written with diacritics also matches text without them")
    void matchesAcrossDiacritics() {
        ReviewBannedWordMatcher withDiacritics = matcher("lừa đảo");

        assertThat(withDiacritics.firstMatch("shop nay lua dao")).contains("lừa đảo");
        assertThat(withDiacritics.firstMatch("shop này lừa đảo")).contains("lừa đảo");
    }

    @Test
    @DisplayName("matching is whole-word: a short term does not fire inside a longer word")
    void doesNotMatchSubstrings() {
        ReviewBannedWordMatcher shortTerm = matcher("dm");

        // "admin" contains "dm"; a substring matcher would block this legitimate review.
        assertThat(shortTerm.firstMatch("nhờ admin tư vấn thêm")).isEmpty();
        assertThat(shortTerm.firstMatch("giao hàng nhanh, cảm ơn")).isEmpty();
    }

    @Test
    @DisplayName("multi-word terms match only a consecutive run of words")
    void multiWordTermsNeedAdjacency() {
        ReviewBannedWordMatcher phrase = matcher("hàng giả");

        assertThat(phrase.firstMatch("đây là hàng giả")).contains("hàng giả");
        assertThat(phrase.firstMatch("hàng này giả ở chỗ nào")).isEmpty();
    }

    @Test
    @DisplayName("the original spelling is returned so the moderator recognises the term")
    void returnsShopSpelling() {
        assertThat(matcher("Lừa Đảo").firstMatch("shop lua dao")).contains("Lừa Đảo");
    }

    @Test
    @DisplayName("one-character and blank entries are dropped as unusable")
    void rejectsTooShortTerms() {
        ReviewBannedWordMatcher onlyNoise = matcher("a, , !, b");

        assertThat(onlyNoise.isEmpty()).isTrue();
        assertThat(onlyNoise.firstMatch("a b c d")).isEmpty();
    }

    @Test
    @DisplayName("the term list is capped so a pasted wall of text cannot blow up the check")
    void capsTermCount() {
        StringBuilder huge = new StringBuilder();
        for (int index = 0; index < 900; index++) {
            huge.append("term").append(index).append(',');
        }
        ReviewBannedWordMatcher capped = matcher(huge.toString());

        assertThat(capped.firstMatch("chứa term0 ở đây")).contains("term0");
        // Entry 600 falls past the 500-term cap and is therefore not enforced.
        assertThat(capped.firstMatch("chứa term600 ở đây")).isEmpty();
    }

    @Test
    @DisplayName("clean text returns no match")
    void cleanTextPasses() {
        ReviewBannedWordMatcher terms = matcher("lừa đảo, dm");

        assertThat(terms.firstMatch("Mũ đội vừa đầu, giao hàng nhanh, rất hài lòng.")).isEmpty();
        assertThat(terms.firstMatch(null)).isEmpty();
        assertThat(terms.firstMatch("")).isEmpty();
    }
}
