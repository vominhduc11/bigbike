package com.bigbike.bigbike_backend.api.admin.dto;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record UpdateAdminUserRequest(
        @Size(max = 255, message = "Tên hiển thị không được vượt quá 255 ký tự.")
        String displayName,

        @Pattern(
                regexp = "(?i)^$|^(INVITED|ACTIVE|DISABLED|SUSPENDED)$",
                message = "Trạng thái không hợp lệ."
        )
        String status,

        @Size(max = 128, message = "Mật khẩu không được vượt quá 128 ký tự.")
        String newPassword,

        @Size(max = 50, message = "Vai trò không được vượt quá 50 ký tự.")
        String role
) {}
