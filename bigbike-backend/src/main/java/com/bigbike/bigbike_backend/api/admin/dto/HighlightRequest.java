package com.bigbike.bigbike_backend.api.admin.dto;

import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Một mục Ưu điểm / Nhược điểm (V175). Dùng cho cả {@code positiveNotes} và
 * {@code negativeNotes} trên {@link UpsertProductRequest}; backend gán {@code kind}
 * theo mảng nguồn. Song ngữ inline — English tùy chọn (PRODUCT_RULE_001).
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class HighlightRequest {

    @Size(max = 2000, message = "Highlight content is too long.")
    private String content;

    @Size(max = 2000, message = "Highlight English content is too long.")
    private String contentEn;

    private Integer sortOrder;
}
