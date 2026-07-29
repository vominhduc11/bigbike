package com.bigbike.bigbike_backend.api.admin.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;

public record CreateRoleRequest(
        @NotBlank(message = "Mã vai trò không được để trống.")
        @Size(min = 2, max = 50, message = "Mã vai trò phải có từ 2 đến 50 ký tự.")
        String id,

        @NotBlank(message = "Tên vai trò không được để trống.")
        @Size(max = 100, message = "Tên vai trò không được vượt quá 100 ký tự.")
        String name,

        @Size(max = 1000, message = "Mô tả không được vượt quá 1000 ký tự.")
        String description,

        @Size(max = 300, message = "Danh sách quyền không được vượt quá 300 mục.")
        List<@NotBlank(message = "Mã quyền không được để trống.")
        @Size(max = 120, message = "Mã quyền không được vượt quá 120 ký tự.") String> permissions
) {}
