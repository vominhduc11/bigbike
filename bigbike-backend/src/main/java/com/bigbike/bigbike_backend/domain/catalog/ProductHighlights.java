package com.bigbike.bigbike_backend.domain.catalog;

import java.util.List;

/**
 * Ưu điểm / Nhược điểm sản phẩm gộp thành 1 field lồng (2026-07-07) — thay 2 field
 * top-level {@code positiveNotes}/{@code negativeNotes} cũ. Lưu trữ vật lý là 1 cột JSONB
 * duy nhất {@code products.highlights} (V331/V332, thay cho bảng con {@code product_highlights}
 * cũ phân biệt bằng {@code kind} PRO/CON) — xem
 * {@code com.bigbike.bigbike_backend.persistence.converter.ProductHighlightsConverter}.
 */
public record ProductHighlights(
        List<ProductHighlight> positiveNotes,
        List<ProductHighlight> negativeNotes
) {
    public static final ProductHighlights EMPTY = new ProductHighlights(List.of(), List.of());
}
