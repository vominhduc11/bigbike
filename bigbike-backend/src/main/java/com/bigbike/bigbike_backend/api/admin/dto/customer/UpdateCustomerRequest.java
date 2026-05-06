package com.bigbike.bigbike_backend.api.admin.dto.customer;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record UpdateCustomerRequest(
        @Email(message = "Địa chỉ email không hợp lệ.")
        @Size(max = 255, message = "Email không được vượt quá 255 ký tự.")
        String email,

        @Pattern(regexp = "^\\+?[0-9]{8,15}$", message = "Số điện thoại không hợp lệ.")
        String phone,

        @Size(max = 255, message = "Tên hiển thị không được vượt quá 255 ký tự.")
        String displayName,

        @Size(max = 127, message = "Tên không được vượt quá 127 ký tự.")
        String firstName,

        @Size(max = 127, message = "Họ không được vượt quá 127 ký tự.")
        String lastName
) {}
