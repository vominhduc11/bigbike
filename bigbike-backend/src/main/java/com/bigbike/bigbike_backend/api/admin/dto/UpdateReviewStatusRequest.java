package com.bigbike.bigbike_backend.api.admin.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;

public record UpdateReviewStatusRequest(
        @NotBlank(message = "Trạng thái không được để trống.")
        @Pattern(
                regexp = "(?i)APPROVED|PENDING|SPAM|TRASH",
                message = "Trạng thái không hợp lệ. Chỉ chấp nhận: APPROVED, PENDING, SPAM, TRASH."
        )
        String status,
        @NotNull(message = "Phiên bản đánh giá không được để trống.")
        @PositiveOrZero(message = "Phiên bản đánh giá không hợp lệ.")
        Long expectedVersion
) {}
