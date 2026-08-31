package com.bigbike.bigbike_backend.api.public_.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.List;

public record SubmitReviewRequest(
        String authorName,

        // Guest email is validated in the service. For an authenticated customer,
        // both identity fields are ignored and resolved from the current account.
        String authorEmail,

        // REVIEW_RULE_008: bước 0,5 sao (1.0..5.0) — kiểm tra đúng 1 trong 9 mức thực hiện ở service (ReviewRatingLevels).
        @NotNull(message = "Vui lòng chọn số sao đánh giá.")
        @DecimalMin(value = "1.0", message = "Đánh giá phải từ 1 đến 5 sao.")
        @DecimalMax(value = "5.0", message = "Đánh giá phải từ 1 đến 5 sao.")
        BigDecimal rating,

        @Size(max = 1000, message = "Nhận xét không được vượt quá 1000 ký tự.")
        String comment,

        @Size(max = 10, message = "Chỉ được đính kèm tối đa 10 ảnh.")
        List<String> photos,

        String website,

        @Size(max = 256, message = "Đường dẫn mời đánh giá không hợp lệ.")
        String inviteToken
) {
    /** Source-compatible constructor for existing callers that do not use an invitation. */
    public SubmitReviewRequest(
            String authorName,
            String authorEmail,
            BigDecimal rating,
            String comment,
            List<String> photos,
            String website
    ) {
        this(authorName, authorEmail, rating, comment, photos, website, null);
    }
}
