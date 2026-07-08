package com.bigbike.bigbike_backend.api.admin.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Ưu điểm / Nhược điểm gộp thành 1 field lồng (2026-07-07) trên
 * {@link UpsertProductRequest} — thay 2 field top-level {@code positiveNotes}/
 * {@code negativeNotes} cũ. Mỗi nhóm vẫn full-replace ĐỘC LẬP: {@code null} =
 * không đụng nhóm đó (xem {@code AdminCatalogMutationService}).
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class HighlightsRequest {

    @Valid
    @Size(max = 20, message = "Pros may not have more than 20 items.")
    private List<HighlightRequest> positiveNotes;

    @Valid
    @Size(max = 20, message = "Cons may not have more than 20 items.")
    private List<HighlightRequest> negativeNotes;
}
