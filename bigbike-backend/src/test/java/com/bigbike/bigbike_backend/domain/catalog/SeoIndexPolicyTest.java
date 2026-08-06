package com.bigbike.bigbike_backend.domain.catalog;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/**
 * Khoá ngưỡng "đủ nội dung tiếng Anh" và cách hai cờ VI/EN kết hợp.
 * Rule: BUSINESS_RULES {@code SEO_RULE_001} + {@code SEO_RULE_002} (owner chốt 2026-08-06).
 */
class SeoIndexPolicyTest {

    @Nested
    @DisplayName("SEO_RULE_002 — ngưỡng đủ nội dung tiếng Anh")
    class EnglishReady {

        @Test
        @DisplayName("sản phẩm: cần tên EN + ít nhất một phần mô tả EN")
        void product() {
            assertThat(SeoIndexPolicy.productEnglishReady("Helmet", "Short desc", null)).isTrue();
            assertThat(SeoIndexPolicy.productEnglishReady("Helmet", null, "Long desc")).isTrue();

            assertThat(SeoIndexPolicy.productEnglishReady("Helmet", null, null)).isFalse();
            assertThat(SeoIndexPolicy.productEnglishReady(null, "Short desc", "Long desc")).isFalse();
            assertThat(SeoIndexPolicy.productEnglishReady("  ", "Short desc", null)).isFalse();
            assertThat(SeoIndexPolicy.productEnglishReady("Helmet", "   ", "  ")).isFalse();
        }

        @Test
        @DisplayName("danh mục: cần tên EN + mô tả hoặc nội dung giới thiệu EN")
        void category() {
            assertThat(SeoIndexPolicy.categoryEnglishReady("Helmets", "Desc", null)).isTrue();
            assertThat(SeoIndexPolicy.categoryEnglishReady("Helmets", null, "Intro")).isTrue();

            assertThat(SeoIndexPolicy.categoryEnglishReady("Helmets", null, null)).isFalse();
            assertThat(SeoIndexPolicy.categoryEnglishReady(null, "Desc", "Intro")).isFalse();
        }

        @Test
        @DisplayName("thương hiệu: chỉ xét mô tả EN (bảng brands không có name_en/slug_en — DROP ở V352)")
        void brand() {
            assertThat(SeoIndexPolicy.brandEnglishReady("An English description")).isTrue();
            assertThat(SeoIndexPolicy.brandEnglishReady(null)).isFalse();
            assertThat(SeoIndexPolicy.brandEnglishReady("  ")).isFalse();
        }

        @Test
        @DisplayName("bài viết: cần tiêu đề EN + thân bài EN")
        void article() {
            assertThat(SeoIndexPolicy.articleEnglishReady("Title", "<p>Body</p>")).isTrue();

            assertThat(SeoIndexPolicy.articleEnglishReady("Title", null)).isFalse();
            assertThat(SeoIndexPolicy.articleEnglishReady(null, "<p>Body</p>")).isFalse();
        }
    }

    @Nested
    @DisplayName("SEO_RULE_001 — hai cờ tách theo ngôn ngữ")
    class ResolveNoIndex {

        @Test
        @DisplayName("bản VI chỉ đọc cờ VI, không quan tâm nội dung EN")
        void vietnameseIgnoresEnglish() {
            assertThat(SeoIndexPolicy.resolveNoIndex("vi", false, true, false)).isFalse();
            assertThat(SeoIndexPolicy.resolveNoIndex("vi", true, false, true)).isTrue();
            assertThat(SeoIndexPolicy.resolveNoIndex(null, false, true, false)).isFalse();
        }

        @Test
        @DisplayName("bản EN: chưa đủ nội dung là noIndex, kể cả khi cờ EN đang bật cho hiển thị")
        void englishGatedByContent() {
            assertThat(SeoIndexPolicy.resolveNoIndex("en", false, false, false)).isTrue();
            assertThat(SeoIndexPolicy.resolveNoIndex("en", false, false, true)).isFalse();
        }

        @Test
        @DisplayName("bản EN: cờ thủ công ẩn được cả trang đã đủ nội dung")
        void englishManualOverride() {
            assertThat(SeoIndexPolicy.resolveNoIndex("en", false, true, true)).isTrue();
        }

        @Test
        @DisplayName("tắt bản VI KHÔNG tự tắt bản EN và ngược lại — đây là điểm chính của SEO_RULE_001")
        void flagsAreIndependent() {
            // VI tắt, EN đủ nội dung và đang bật → EN vẫn hiển thị.
            assertThat(SeoIndexPolicy.resolveNoIndex("vi", true, false, true)).isTrue();
            assertThat(SeoIndexPolicy.resolveNoIndex("en", true, false, true)).isFalse();
        }

        @Test
        @DisplayName("nhận diện locale không phân biệt hoa thường và khoảng trắng")
        void localeParsing() {
            assertThat(SeoIndexPolicy.isEnglish("en")).isTrue();
            assertThat(SeoIndexPolicy.isEnglish("EN")).isTrue();
            assertThat(SeoIndexPolicy.isEnglish(" en ")).isTrue();
            assertThat(SeoIndexPolicy.isEnglish("vi")).isFalse();
            assertThat(SeoIndexPolicy.isEnglish(null)).isFalse();
        }
    }
}
