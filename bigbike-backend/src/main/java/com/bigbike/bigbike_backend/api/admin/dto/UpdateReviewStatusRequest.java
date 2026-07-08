package com.bigbike.bigbike_backend.api.admin.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record UpdateReviewStatusRequest(
        @NotBlank(message = "Trạng thái không được để trống.")
        @Pattern(
                regexp = "(?i)APPROVED|PENDING|SPAM|TRASH",
                message = "Trạng thái không hợp lệ. Chỉ chấp nhận: APPROVED, PENDING, SPAM, TRASH."
        )
        String status
) {}
