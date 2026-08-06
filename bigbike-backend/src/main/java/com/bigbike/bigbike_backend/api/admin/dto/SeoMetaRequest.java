package com.bigbike.bigbike_backend.api.admin.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SeoMetaRequest {

    @Size(max = 255, message = "SEO title is too long.")
    private String title;

    @Size(max = 5000, message = "SEO description is too long.")
    private String description;

    @Size(max = 2048, message = "Canonical URL is too long.")
    private String canonicalUrl;

    @Valid
    private ImageAssetRequest ogImage;

    /**
     * Cờ "không cho Google hiển thị" bản TIẾNG VIỆT (V222 cho bài viết, V371 mở rộng cho
     * sản phẩm/danh mục/thương hiệu). {@code null} = giữ nguyên giá trị hiện có.
     * BUSINESS_RULES {@code SEO_RULE_001}.
     */
    private Boolean noIndex;

    /**
     * Cờ "không cho Google hiển thị" bản TIẾNG ANH (V371). {@code null} = giữ nguyên.
     *
     * <p>Đây chỉ là lớp ghi đè thủ công: gửi {@code false} cho một thực thể chưa đủ nội dung
     * tiếng Anh vẫn cho ra {@code seo.noIndex: true} khi đọc bằng {@code lang=en} — ngưỡng
     * {@code SEO_RULE_002} được tính động, không ghi đè được qua API.
     */
    private Boolean noIndexEn;
}
