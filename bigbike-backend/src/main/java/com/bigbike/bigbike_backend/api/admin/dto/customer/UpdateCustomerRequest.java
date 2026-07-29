package com.bigbike.bigbike_backend.api.admin.dto.customer;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;

public record UpdateCustomerRequest(
        // Read-only compatibility sentinel: retained only so stale clients receive
        // deterministic field validation instead of having an identity write ignored.
        @Email(message = "Địa chỉ email không hợp lệ.")
        @Size(max = 255, message = "Email không được vượt quá 255 ký tự.")
        String email,

        @Size(max = 50, message = "Số điện thoại không được vượt quá 50 ký tự.")
        String phone,

        @Size(max = 255, message = "Tên hiển thị không được vượt quá 255 ký tự.")
        String displayName,

        // Read-only compatibility sentinels; AdminCustomerService rejects non-null values.
        @Size(max = 127, message = "Tên không được vượt quá 127 ký tự.")
        String firstName,

        @Size(max = 127, message = "Họ không được vượt quá 127 ký tự.")
        String lastName
) {}
