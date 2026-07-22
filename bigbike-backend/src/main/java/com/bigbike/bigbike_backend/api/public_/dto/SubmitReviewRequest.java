package com.bigbike.bigbike_backend.api.public_.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.List;

public record SubmitReviewRequest(
        @NotBlank(message = "Vui lòng nhập tên.")
        @Size(max = 80, message = "Tên không được vượt quá 80 ký tự.")
        String authorName,

        // Email tùy chọn — form thu để shop liên hệ lại; lưu vào review (AUD-032).
        @Email(message = "Email không hợp lệ.")
        @Size(max = 255, message = "Email không được vượt quá 255 ký tự.")
        String authorEmail,

        // REVIEW_RULE_008: bước 0,5 sao (1.0..5.0) — kiểm tra đúng 1 trong 10 mức thực hiện ở service (ReviewRatingLevels).
        @NotNull(message = "Vui lòng chọn số sao đánh giá.")
        @DecimalMin(value = "1.0", message = "Đánh giá phải từ 1 đến 5 sao.")
        @DecimalMax(value = "5.0", message = "Đánh giá phải từ 1 đến 5 sao.")
        BigDecimal rating,

        @Size(max = 1000, message = "Nhận xét không được vượt quá 1000 ký tự.")
        String comment,

        @Size(max = 10, message = "Chỉ được đính kèm tối đa 10 ảnh.")
        List<String> photos,

        String website
) {}
