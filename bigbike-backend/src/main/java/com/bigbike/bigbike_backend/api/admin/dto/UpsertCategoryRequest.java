package com.bigbike.bigbike_backend.api.admin.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
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
public class UpsertCategoryRequest {

    @Pattern(regexp = "^[a-z0-9]+(?:-[a-z0-9]+)*$", message = "slug must be lowercase alphanumeric with hyphens.")
    @Size(max = 100, message = "slug must be at most 100 characters.")
    private String slug;

    @Size(max = 255, message = "name must be at most 255 characters.")
    private String name;

    @Size(max = 5000, message = "description must be at most 5000 characters.")
    private String description;

    /**
     * Khối giới thiệu hiển thị ở ĐẦU trang danh mục (trên lưới sản phẩm) — rich HTML,
     * lưu vào {@code CategoryEntity.introContent} (cột intro_content, đổi từ content_bottom — V290).
     * Presence-flag: bỏ khóa thì PATCH giữ nguyên; gửi null/blank để xoá.
     */
    @Size(max = 50000, message = "introContent must be at most 50000 characters.")
    private String introContent;

    private String parentId;

    private Boolean visible;

    private Boolean showOnHomepage;

    private Integer sortOrder;

    @Valid
    private ImageAssetRequest image;

    @Valid
    private ImageAssetRequest icon;

    /**
     * Icon line đơn sắc cạnh tên danh mục gốc trong menu đầu trang (render qua mask-image).
     * Chỉ {@code url} được lưu vào {@code CategoryEntity.menuIconUrl}; danh mục con bị bỏ qua
     * im lặng và luôn lưu trống. Validation có điều kiện được thực hiện trong service vì PATCH
     * có thể không gửi {@code parentId} và khi đó cần biết parent hiện tại của entity.
     */
    private ImageAssetRequest menuIcon;

    @Valid
    private ImageAssetRequest banner;

    @Valid
    private ImageAssetRequest mobileBanner;

    @Valid
    private SeoMetaRequest seo;

    @Valid
    private CategoryTranslationRequest translations;
}
