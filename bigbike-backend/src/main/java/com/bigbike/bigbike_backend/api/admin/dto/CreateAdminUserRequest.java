package com.bigbike.bigbike_backend.api.admin.dto;

import jakarta.validation.constraints.Size;

public record CreateAdminUserRequest(
        @Size(max = 255, message = "Email không được vượt quá 255 ký tự.")
        String email,

        @Size(max = 255, message = "Tên hiển thị không được vượt quá 255 ký tự.")
        String displayName,

        @Size(max = 50, message = "Vai trò không được vượt quá 50 ký tự.")
        String role
) {}
