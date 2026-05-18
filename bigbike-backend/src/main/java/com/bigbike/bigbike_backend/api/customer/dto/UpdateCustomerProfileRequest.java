package com.bigbike.bigbike_backend.api.customer.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record UpdateCustomerProfileRequest(
        @Size(max = 255, message = "Tên hiển thị không được vượt quá 255 ký tự.")
        String displayName,

        @Pattern(regexp = "^\\+?[0-9]{8,15}$", message = "Số điện thoại không hợp lệ.")
        String phone,

        @Email(message = "Địa chỉ email không hợp lệ.")
        @Size(max = 255, message = "Email không được vượt quá 255 ký tự.")
        String email,

        String currentPassword,

        @Size(min = 8, max = 256, message = "Mật khẩu mới phải có 8–256 ký tự.")
        String newPassword,

        @Pattern(regexp = "^(male|female|other)?$", message = "Giới tính không hợp lệ.")
        String gender,

        String dob,

        Boolean newsletterSubscribed
) {}
