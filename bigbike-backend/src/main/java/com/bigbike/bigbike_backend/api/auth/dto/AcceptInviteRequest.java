package com.bigbike.bigbike_backend.api.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AcceptInviteRequest(
        @NotBlank(message = "Mã lời mời không được để trống.")
        String token,

        @NotBlank(message = "Mật khẩu không được để trống.")
        @Size(min = 8, max = 128, message = "Mật khẩu phải có từ 8 đến 128 ký tự.")
        String password
) {}
