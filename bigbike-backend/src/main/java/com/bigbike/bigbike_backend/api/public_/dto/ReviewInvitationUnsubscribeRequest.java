package com.bigbike.bigbike_backend.api.public_.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ReviewInvitationUnsubscribeRequest(
        @NotBlank(message = "Thiếu mã từ chối thư mời.")
        @Size(max = 256, message = "Mã từ chối thư mời không hợp lệ.")
        String token
) {}
