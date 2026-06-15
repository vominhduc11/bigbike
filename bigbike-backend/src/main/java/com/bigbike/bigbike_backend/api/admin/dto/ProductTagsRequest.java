package com.bigbike.bigbike_backend.api.admin.dto;

import jakarta.validation.constraints.Size;
import java.util.List;

/** Body cho PUT /admin/products/{id}/tags — thay thế toàn bộ tag của sản phẩm. */
public record ProductTagsRequest(
        @Size(max = 50, message = "Tối đa 50 tag mỗi sản phẩm.")
        List<@Size(max = 100, message = "Mỗi tag tối đa 100 ký tự.") String> tags
) {
}
