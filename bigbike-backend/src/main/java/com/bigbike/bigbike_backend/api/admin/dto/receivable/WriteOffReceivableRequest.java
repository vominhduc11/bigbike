package com.bigbike.bigbike_backend.api.admin.dto.receivable;

import jakarta.validation.constraints.NotBlank;

public record WriteOffReceivableRequest(
        @NotBlank(message = "reason là bắt buộc khi xóa nợ")
        String reason
) {}
