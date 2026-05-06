package com.bigbike.bigbike_backend.api.customer.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CustomerRegisterRequest(
        @Email(message = "Địa chỉ email không hợp lệ.")
        String email,

        @Pattern(regexp = "^\\+?[0-9]{8,15}$", message = "Số điện thoại không hợp lệ.")
        String phone,

        @Size(min = 8, max = 256, message = "Mật khẩu phải có 8–256 ký tự.")
        String password,

        String displayName,

        @Size(max = 127, message = "Tên không được vượt quá 127 ký tự.")
        String firstName,

        @Size(max = 127, message = "Họ không được vượt quá 127 ký tự.")
        String lastName
) {}
