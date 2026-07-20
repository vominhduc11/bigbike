package com.bigbike.bigbike_backend.api.admin.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Một mục Ưu điểm / Nhược điểm (V175). Dùng cho cả {@code positiveNotes} và
 * {@code negativeNotes} trên {@link UpsertProductRequest}; backend gán {@code kind}
 * theo mảng nguồn. Nội dung là rich-text HTML song ngữ inline — English tùy chọn
 * (PRODUCT_RULE_001); web chịu trách nhiệm sanitize khi render.
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class HighlightRequest {

    // content/contentEn is the bilingual pair — ALWAYS so export (EXPORT_MAPPER is NON_NULL by
    // default) still emits both sides, null-filling whichever is blank.
    @JsonInclude(JsonInclude.Include.ALWAYS)
    @Size(max = 20000, message = "Highlight content is too long.")
    private String content;

    @JsonInclude(JsonInclude.Include.ALWAYS)
    @Size(max = 20000, message = "Highlight English content is too long.")
    private String contentEn;

    private Integer sortOrder;
}
