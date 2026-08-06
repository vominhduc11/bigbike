package com.bigbike.bigbike_backend.domain.catalog;

/**
 * Nơi DUY NHẤT quyết định một trang có được khai báo với công cụ tìm kiếm hay không.
 *
 * <p>Rule: {@code docs/business/BUSINESS_RULES.md} — {@code SEO_RULE_001} (cờ thủ công tách theo
 * ngôn ngữ) và {@code SEO_RULE_002} (ngưỡng đủ nội dung tiếng Anh). Owner chốt 2026-08-06.
 *
 * <p>Hai tầng chồng lên nhau:
 * <ol>
 *   <li><b>Cờ thủ công</b> — cột {@code seo_no_index} (bản VI) và {@code seo_no_index_en}
 *       (bản EN), thêm ở {@code V371}. Admin bật/tắt được.</li>
 *   <li><b>Ngưỡng đủ nội dung EN</b> — tính động từ chính dữ liệu, KHÔNG lưu thành cột. Một trang
 *       tiếng Anh chưa có tên/tiêu đề EN và phần mô tả/thân bài EN thì luôn {@code noIndex},
 *       bất kể cờ. Nhờ vậy bản dịch mới tạo tự động ẩn cho tới khi có nội dung, và dịch xong là
 *       tự hiện — không cần ai nhớ bấm nút.</li>
 * </ol>
 *
 * <p>{@code slug_en} CỐ Ý không tham gia ngưỡng: {@code PRODUCT_RULE_003} /
 * {@code CATEGORY_RULE_003} / {@code ARTICLE_RULE_003} đều ghi rõ "slugEn chỉ là slug EN ưu tiên,
 * không phải điều kiện tồn tại trang". Đưa nó vào ngưỡng sẽ loại 166/180 sản phẩm và 174/174 bài
 * viết khỏi index tiếng Anh — đo ngày 2026-08-06.
 */
public final class SeoIndexPolicy {

    private SeoIndexPolicy() {
    }

    private static boolean present(String value) {
        return value != null && !value.isBlank();
    }

    /**
     * Sản phẩm: cần tên tiếng Anh và ít nhất một phần mô tả tiếng Anh.
     * Đạt ngưỡng 135/180 sản phẩm PUBLISHED tại thời điểm chốt rule.
     */
    public static boolean productEnglishReady(String nameEn, String shortDescriptionEn, String descriptionEn) {
        return present(nameEn) && (present(shortDescriptionEn) || present(descriptionEn));
    }

    /**
     * Danh mục: cần tên tiếng Anh và phần mô tả hoặc nội dung giới thiệu tiếng Anh.
     * Đạt ngưỡng 31/35 danh mục hiện.
     */
    public static boolean categoryEnglishReady(String nameEn, String descriptionEn, String introContentEn) {
        return present(nameEn) && (present(descriptionEn) || present(introContentEn));
    }

    /**
     * Thương hiệu: chỉ xét phần mô tả tiếng Anh. Bảng {@code brands} không có {@code name_en} hay
     * {@code slug_en} (đã DROP ở {@code V352}) và tên thương hiệu là danh từ riêng nên không cần
     * dịch. Đạt ngưỡng 13/19 thương hiệu hiện.
     */
    public static boolean brandEnglishReady(String descriptionEn) {
        return present(descriptionEn);
    }

    /**
     * Bài viết: cần tiêu đề tiếng Anh và thân bài tiếng Anh — thân bài chính là toàn bộ giá trị
     * của trang. Đạt ngưỡng 75/174 bài viết PUBLISHED.
     */
    public static boolean articleEnglishReady(String titleEn, String bodyEn) {
        return present(titleEn) && present(bodyEn);
    }

    /**
     * Giá trị {@code seo.noIndex} phát ra cho một locale cụ thể.
     *
     * @param locale       ngôn ngữ của request ({@code "en"} = bản tiếng Anh, còn lại = VI)
     * @param noIndexVi    cờ thủ công bản tiếng Việt
     * @param noIndexEn    cờ thủ công bản tiếng Anh
     * @param englishReady bản tiếng Anh đã đạt ngưỡng {@code SEO_RULE_002} chưa
     */
    public static boolean resolveNoIndex(String locale, boolean noIndexVi, boolean noIndexEn, boolean englishReady) {
        if (isEnglish(locale)) {
            return noIndexEn || !englishReady;
        }
        return noIndexVi;
    }

    public static boolean isEnglish(String locale) {
        return locale != null && locale.trim().equalsIgnoreCase("en");
    }
}
