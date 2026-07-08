package com.bigbike.bigbike_backend.api.admin.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;

public record UpdateRolePermissionsRequest(
        @Size(max = 300, message = "Danh sách quyền không được vượt quá 300 mục.")
        List<@NotBlank(message = "Mã quyền không được để trống.")
        @Size(max = 120, message = "Mã quyền không được vượt quá 120 ký tự.") String> permissions
) {}
