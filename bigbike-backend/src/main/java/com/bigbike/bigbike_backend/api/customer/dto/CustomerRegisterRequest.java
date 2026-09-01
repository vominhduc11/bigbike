package com.bigbike.bigbike_backend.api.customer.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CustomerRegisterRequest(
        @Email(message = "Địa chỉ email không hợp lệ.")
        String email,

        String phone,

        @Size(min = 8, max = 256, message = "Mật khẩu phải có 8–256 ký tự.")
        String password,

        String displayName,

        @Size(max = 127, message = "Tên không được vượt quá 127 ký tự.")
        String firstName,

        @Size(max = 127, message = "Họ không được vượt quá 127 ký tự.")
        String lastName,

        @NotNull(message = "Vui lòng đồng ý với Chính sách bảo mật.")
        @AssertTrue(message = "Vui lòng đồng ý với Chính sách bảo mật.")
        Boolean privacyConsent,

        @NotBlank(message = "Ngôn ngữ Chính sách bảo mật là bắt buộc.")
        @Pattern(regexp = "^(vi|en)$", message = "Ngôn ngữ Chính sách bảo mật không hợp lệ.")
        String privacyPolicyLocale
) {}
