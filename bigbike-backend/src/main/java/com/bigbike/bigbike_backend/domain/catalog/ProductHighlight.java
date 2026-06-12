package com.bigbike.bigbike_backend.domain.catalog;

/**
 * Một mục Ưu điểm / Nhược điểm (V175) — schema.org positiveNotes / negativeNotes.
 * {@code content} đã resolve theo locale; {@code contentEn} chỉ có trên admin reads
 * (null trên public) để editor hiển thị song ngữ, mirror {@link ProductFaq}.
 */
public record ProductHighlight(
        String content,
        String contentEn
) {
}
