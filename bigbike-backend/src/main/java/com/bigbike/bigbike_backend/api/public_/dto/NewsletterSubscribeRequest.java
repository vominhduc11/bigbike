package com.bigbike.bigbike_backend.api.public_.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Body của POST /api/v1/newsletter — đăng ký nhận tin qua email. */
public record NewsletterSubscribeRequest(
        @NotBlank(message = "Vui lòng nhập email.")
        @Email(message = "Email không hợp lệ.")
        @Size(max = 255, message = "Email quá dài.")
        String email
) {
}
